from pydantic import BaseModel, Field
from typing import Dict, List, AnyStr, Optional, Any, TypedDict, Annotated, Tuple
from langchain.schema import Document
import operator
from fastapi import UploadFile, File, Form

# DATA MODEL FOR RAR AGENT
# class ResumeFeedback(BaseModel):
#     candidate_name: str
#     analysis: str
#     scores: Dict[str, int]
#     total_score: int
#     key_strengths: list[str]
#     areas_for_improvement: list[str]

# (GEMINI) DATA MODEL FOR RAR AGENT
class ResumeScores(BaseModel):
    skills_match: int
    experience_relevance: int
    education_fit: int
    cultural_fit: int
    overall_impression: int

class ResumeFeedback(BaseModel):
    candidate_name: str
    analysis: str
    scores: ResumeScores
    total_score: int # TOTAL SCORE FOR FIELD
    key_strengths: list[str]
    areas_for_improvement: list[str]

# DATA MODEL FOR CJC AGENT
class JobResumeMatch(BaseModel):
    job_description_name: str
    candidate_name: str
    match_score: float
    match_explanation: str

### ORIGINAL DATA MODEL FOR CJC AGENT ###
## (OPENAI) DATA MODEL FOR CJC AGENT
# class CrossJobMatchResult(BaseModel):
#     job_resume_matches: list[JobResumeMatch]
#     best_matches_per_job: Dict[str, str]  # job_name -> best_resume_name 
#     best_matches_per_resume: Dict[str, str]  # resume_name -> best_job_name # EXTRACT SCORES FROM RESUME FEEDBACK
#     overall_recommendation: str

### ADJUSTED DATA MODEL FOR CJC AGENT ###
class CrossJobMatchResult(BaseModel):
    job_resume_matches: List[JobResumeMatch]
    best_matches_per_resume: Dict[str, str]  # resume_name -> best_job_name
    overall_recommendation: str

# OVERALL STATE OF THE MULTI-AGENT SYSTEM
class MultiJobComparisonState(TypedDict):
    job_openings: Annotated[List[Dict[str, Any]], "List of Job Openings"]
    resumes: Annotated[List[Dict[str, Any]], "List of Candidate's Resumes"]
    all_rankings: Annotated[Dict[str, List[ResumeFeedback]], "Ranking of all Candidates per Job Opening"]
    final_recommendations: CrossJobMatchResult
    # processed_job_description: Annotated[List[AnyStr], operator.add]

##### DATA MODEL FOR API REQUESTS #####

# DATA MODEL FOR PARSING CONTENT FROM FILES
class ProcessedResume(BaseModel):
    page_content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

# DATA MODEL FOR JOBJIGSAW REQUEST
class AnalysisRequest(BaseModel):
    job_openings: list[dict[str, Any]] # KEYS => name, content
    # resumes: list[dict[str, Any]] # KEYS => page_content, metadata {'source': file_name}
    resumes: List[ProcessedResume]
    # job_openings: List[Dict[str, Any]]
    # resumes: List[UploadFile] = File(..., alias="resumes")


# DATA MODEL FOR JOBJIGSAW STATUS OF ANALYSIS REQUEST
class StatusResponse(BaseModel):
    trace_id: str
    status: str
    progress: Optional[dict[str, str]] = None
    results: Optional[dict[str, Any]] = None

# DATA MODEL FOR JOBJIGSAW START RESPONSE
class StartResponse(BaseModel):
    trace_id: str
    message: str
