# INTERNAL IMPORTS
from utils import CacheManager, process_pdfs
from data_models import AnalysisRequest, StartResponse, StatusResponse, ResumeFeedback, JobResumeMatch, CrossJobMatchResult, ProcessedResume
# from graph import create_multi_job_comparison_graph

# REQUEST PROCESSING MODULE
from langchain.schema import Document
from uuid import uuid4

# API HANDLING MODULE
from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends, Security, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager

# UTILITIES 
import os
import sys
from typing_extensions import Callable, Dict, List, AnyStr, Any
from dotenv import load_dotenv
import logging

# LOAD ENVIRONMENT VARIABLES 
load_dotenv()

# INITIALIZE CACHE MANAGER
cache_manager = CacheManager()

# DEFINE GLOBAL VARIABLES
validate_extract_agent = None

# INITIALIZE LOGGING
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_langgraph_app():
    """
    Import and initialize your LangGraph application.
    This is separated to avoid circular imports and to allow for dynamic loading.
    """
    # Import your actual LangGraph application components here
    # This is placeholder code - replace with actual imports for your app
    try:
        from graph import create_multi_job_comparison_graph
        
        # Create and return the graph
        return create_multi_job_comparison_graph()
    # except ImportError:
    #     # For development/testing, return a placeholder
    #     print("WARNING: Using mock LangGraph application!")
    except Exception as e:
        raise RuntimeError(f"---ERROR IN 'create_langgraph_app': {str(e)}---")

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        cache_manager.set('compiled_mjc_graph',create_langgraph_app())
        yield  # Yield control to the application
    except Exception as e:
        print(f"Warning: Failed to initialize LangGraph application: {e}")
        print("API will run in mock mode.")
        yield  # Still yield, allowing the app to start (mock mode)

# INITIALIZE FASTAPI APPLICATION
app = FastAPI(
    title="AI-POWERED RESUME ANALYZER RERANKER TOOL API",
    description="API for analyzing and matching resumes to job descriptions",
    version="1.0.0",
    lifespan=lifespan
)

# CONFIGURE RATE LIMITING
limiter = Limiter(key_func=get_remote_address, application_limits=["5/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# SECURITY HEADERS MIDDLEWARE
@app.middleware("http")
async def add_security_headers(request: Request, call_next: Callable) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# CONFIGURE CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# IN-MEMORY JOB TRACKING
jobs = {}

# API KEY SECURITY
API_KEY_NAME = "DIREC-AI-RAR-API-KEY"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

# CONFIGURE DEFAULT OR ALLOWED API KEYS
API_KEYS = {
    os.getenv("DIREC_RAR_API_KEY"): "USER-RHYLIIEEE",
}

async def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header in API_KEYS:
        return api_key_header
    raise HTTPException(
        status_code=403,
        detail="INVALID API KEY"
    )

# def run_analysis(trace_id: str, job_openings: List[Dict[AnyStr, Any]], resumes: List[UploadFile]):
#     """BACKGROUND TASK TO RUN ANALYSIS"""
#     try:
#         # Update job status to running
#         jobs[trace_id]["status"] = "running"
#         jobs[trace_id]["progress"] = {job.get("name", "unknown"): "pending" for job in job_openings}
#         jobs[trace_id]["results"] = None
#         jobs[trace_id]["error"] = None

#         logger.info(f"[{trace_id}] Processing {len(resumes)} uploaded resume files...")
        
#         # PROCESS PDF FILES USING UTILS FUNCTION
#         processed_resume_docs: List[Document] = process_pdfs(resumes)

#         # Convert request models to the format expected by LangGraph
#         input_data = {
#             "job_openings": job_openings,
#             "resumes": processed_resume_docs,
#             "processed_job_description": [],
#             "all_rankings": {}
#         }
        
#         # Update progress tracking
#         for job in job_openings:
#             jobs[trace_id]["progress"][job['name']] = "pending"
        
#         # COMPILE THE MULTI-JOB COMPARISON (MJC) GRAPH
#         if not cache_manager.has('compiled_mjc_graph'):
#             logger.warning(f"[{trace_id}] LANGGRAPH APP NOT FOUND IN CACHE, ATTEMPTING TO CREATE.")
#             try:
#                 cache_manager.set('compiled_mjc_graph', create_langgraph_app())
#             except Exception as graph_error:
#                 logger.error(f"[{trace_id}] CRITICAL: FAILED TO CREATE LANGGRAPH APPLICATION: {graph_error}")
#                 jobs[trace_id]["status"] = "failed"
#                 jobs[trace_id]["error"] = f"FAILED TO INITIALIZE RAR APPLICATION: {graph_error}"
            
#         mjc_graph = cache_manager.get('compiled_mjc_graph')

#         if mjc_graph:
#             # EXECUTE THE GRAPH
#             result = mjc_graph.invoke(input_data)
            
#             # Store results
#             jobs[trace_id]["results"] = result
#             jobs[trace_id]["status"] = "completed"
#     except Exception as e:
#         # Update job status to failed
#         jobs[trace_id]["status"] = "failed"
#         jobs[trace_id]["error"] = str(e)
#         print(f"Error processing job {trace_id}: {e}")

def run_analysis(trace_id: str, job_openings: List[Dict[AnyStr, Any]], resumes: List[Dict[AnyStr, Any]]):
    """BACKGROUND TASK TO RUN ANALYSIS"""
    try:
        # Update job status to running
        jobs[trace_id]["status"] = "running"
        jobs[trace_id]["progress"] = {job.get("name", f"job_{i}"): "pending" for i, job in enumerate(job_openings)}
        jobs[trace_id]["results"] = None
        jobs[trace_id]["error"] = None

        # CONVER PROCESSED RESUME DATA BACK TO LANGCHAIN DOCUMENT
        resume_docs = [
            Document(
                page_content=resume.get('page_content', ''),
                metadata=resume.get('metadata', {})
            ) for resume in resumes
        ]
        
        # Convert request models to the format expected by LangGraph
        input_data = {
            "job_openings": job_openings,
            "resumes": resume_docs,
            "processed_job_description": [],
            "all_rankings": {}
        }
        
        logger.info(f"[{trace_id}] Input data prepared. Checking for compiled graph...")

        # Update progress tracking
        for job in job_openings:
            jobs[trace_id]["progress"][job['name']] = "pending"
        
        # COMPILE THE MULTI-JOB COMPARISON (MJC) GRAPH
        if not cache_manager.has('compiled_mjc_graph'):
            cache_manager.set('compiled_mjc_graph', create_langgraph_app())

        mjc_graph = cache_manager.get('compiled_mjc_graph')

        if mjc_graph:
            logger.info(f"[{trace_id}] Invoking LangGraph application...")
            # EXECUTE THE GRAPH
            result = mjc_graph.invoke(input_data)
            logger.info(f"[{trace_id}] LangGraph execution completed.")

            # Store results and update status
            jobs[trace_id]["results"] = result
            jobs[trace_id]["status"] = "completed"
            logger.info(f"[{trace_id}] Job completed successfully.")
        else:
             logger.error(f"[{trace_id}] Failed to obtain LangGraph application.")
             jobs[trace_id]["status"] = "failed"
             jobs[trace_id]["error"] = "Analysis engine could not be loaded."
    except Exception as e:
        # Update job status to failed
        jobs[trace_id]["status"] = "failed"
        jobs[trace_id]["error"] = str(e)
        print(f"[{trace_id}] Error during background analysis: {str(e)}")


# DEFINE ROOT ENDPOINT
@app.get("/ai")
def root(api_key: str = Depends(get_api_key)):
    return {"Welcome": "You are now inside DBTI's AI ENDPOINT!"}

@app.get("/ai/rar/v1/health")
async def health_check(api_key: str = Depends(get_api_key)):
    """Health check endpoint"""
    return {"status": "ok"}

# ENDPOINT TO PROCESS RESUME FILES TO EXTRACT TEXT CONTENT
@app.post("/ai/rar/v1/process_resumes", response_model=List[ProcessedResume])
@limiter.limit("10/minute") # Allow more frequent calls if needed
async def process_resumes_endpoint(
    request: Request,
    resumes: List[UploadFile] = File(..., description="List of PDF resume files to process"),
    api_key: str = Depends(get_api_key)
):
    """
    Receives PDF files, processes them to extract text and metadata,
    and returns the structured data.
    """
    logger.info(f"Processing {len(resumes)} resume files for API key {api_key[:8]}...")
    processed_docs: List[Document] = []
    try:
        # Ensure process_pdfs handles potential errors for individual files gracefully
        processed_docs = await process_pdfs(resumes) 

        response_data = [
            ProcessedResume(
                page_content=doc.page_content,
                metadata=doc.metadata
            ) for doc in processed_docs
        ]
        logger.info(f"Successfully processed {len(response_data)} resumes.")
        return response_data

    except Exception as e:
        logger.exception(f"Error processing resumes: {str(e)}") # Use logger.exception for traceback
        raise HTTPException(status_code=500, detail=f"Failed to process resumes: {str(e)}")

# DEFINE AND SECURE ENDPOINT FOR THE RAR AGENTS
@app.post("/ai/rar/v1/analyze_and_rerank", response_model=StartResponse, status_code=202)
@limiter.limit("5/minute") # 5 CLIENT REQUESTS PER MINUTE
async def start_analysis(request:Request, analysis_request: AnalysisRequest, background_tasks: BackgroundTasks, api_key: str = Depends(get_api_key)):
    try:
        # LOG THE REQUEST
        logger.info(f"PROCESSING REQUEST FOR API KEY: {api_key[:8]}...")
        logger.info(f"Received {len(analysis_request.job_openings)} job openings and {len(analysis_request.resumes)} processed resumes.")

        
        # GENERATE UNIQUE TRACE ID
        trace_id = str(uuid4())

        print(f"---ANALYSIS REQUEST DATA: {analysis_request}---")

        # INITIALIZE JOB TRACKING
        jobs[trace_id] = {
            "status": "pending",
            "progress": {},
            "results": None,
            "error": None
        }

        # CONVERT PYDANTIC PROCESSEDRESUME BACK TO DICTIONARIES
        resume_data_for_task = [resume.model_dump() for resume in analysis_request.resumes]

        # START BACKGROUND TASK
        background_tasks.add_task(
            run_analysis, 
            trace_id=trace_id,
            job_openings=analysis_request.job_openings,
            resumes=resume_data_for_task
        )
        
        return {
            "trace_id": trace_id,
            "message": "Analysis started"
        }
    except HTTPException as http_exc:
        logger.error(f"HTTP EXCEPTION: {str(http_exc)}")
        raise http_exc
    except Exception as e:
        logger.error(f"GENERAL EXCEPTION: {str(e)}")
        return JSONResponse(content={"status":"error", "message": str(e)}, status_code=500)

@app.get("/ai/rar/v1/status/{trace_id}", response_model=StatusResponse)
async def get_status(trace_id: str):
    """Get the status of an analysis job"""
    if trace_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[trace_id]
    
    return {
        "trace_id": trace_id,
        "status": job["status"],
        "progress": job["progress"],
        "results": job["results"] if job["status"] == "completed" else None
    }

# ERROR HANDLER FOR INVALID API KEYS
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )