from typing import Dict, List, Any, AnyStr, Type
from pydantic import BaseModel, Field, create_model
from langgraph.graph import START, END, StateGraph
from langgraph.graph.state import CompiledStateGraph

# UTILITIES
import time

# INTERNAL IMPORTS
from data_models import MultiJobComparisonState, JobResumeMatch, CrossJobMatchResult
from utils import CacheManager, flatten, clean_fieldname
from agents import create_cjc_agent, create_rar_agent

# INITIALIZE CACHE MANAGER
cache_manager = CacheManager()

# NODE TO ANALYZE AND RANK RESUMES FOR EACH JOB
def rank_resumes_for_jobs(state: MultiJobComparisonState) -> MultiJobComparisonState:
    """RANK RESUMES FOR EACH JOB DESCRIPTION"""
    try:
        # CHECK IF RAR AGENT CHAIN IS ALREADY CACHED
        if not cache_manager.has("rar_agent_chain"):
            cache_manager.set("rar_agent_chain", create_rar_agent())
        
        print(f"---ANALYZING AND RANKING RESUMES IN NODE ONE---")
        
        # GET RAR AGENT CHAIN
        rar_agent_chain = cache_manager.get("rar_agent_chain")

        jobs_to_process = state.get('job_openings', [])
        resumes = state.get('resumes', '')
        # processed_job_description = state.get("processed_job_description", [])
        all_rankings = state.get("all_rankings", {})
        processed_jobs = []

        # FOR EACH JD, AND RESUME INVOKE RAR AGENT
        for job in jobs_to_process:
            job_name = job.get("name", "")
            job_content = job.get("content", "")

            print(f"---PROCESSING JOB: {job_name}---")

            # SKIP CURRENT JOB OPENING IF ALREADY PROCESSED
            # if job_name in processed_job_description:
            #     continue

            # CACHE PROCESSED JOB OPENING FOR PAIRING
            if not cache_manager.has(job_name):
                cache_manager.set(job_name, [""]) # CHECK IF PROPERLY INITIALIZED
                
            # TEMPORARY VARIABLE TO HOLD ANALYZED RESUME
            analyzed_resume = []

            for resume in resumes:
                
                resume_job_pair = cache_manager.get(job_name)

                # CHECK IF resume_job_pair IS A LIST
                print(f"---DATA TYPE OF resume_job_pair: {type(resume_job_pair)}")

                # SKIP IF JOB OPENING-RESUME PAIR IS ALREADY PROCESSED
                if isinstance(resume_job_pair, list) and job_name in resume_job_pair: 
                    '''
                    {
                        "job_name": "rar_agent_output"
                    }
                    '''
                    continue

                resume_content = resume.page_content
                print(f"---ASSESSING {resume.metadata['source']} AGAINST {job_name} IN NODE ONE")
                
                # INVOKE RAR AGENT
                rar_agent_output = rar_agent_chain.invoke({
                    "job_description": job_content,
                    "resume_content": resume_content
                })
                analyzed_resume.append(rar_agent_output) 
                
                # ADD RESUME TO PAIR WITH CURRENT JOB IN CACHE
                cache_manager.append_to_list(job_name, resume.metadata['source'])  

            # PERFORM RANKING AND STORE RESULTS
            # print(f"---CONTENT OF CACHE_MANAGER: {cache_manager.get(job_name)}---\n\n")
            # print(f"---TYPE OF CACHE_MANAGER: {type(cache_manager.get(job_name))}---\n\n")
            ranked_resumes = sorted(analyzed_resume, key=lambda record: record.total_score, reverse=True)
            all_rankings[job_name] = ranked_resumes
            processed_jobs.append(job_name)
        
        return {
            "job_openings": jobs_to_process,
            "resumes": resumes,
            "all_rankings": all_rankings
            # "processed_job_description": processed_jobs
        }
    except Exception as e:
        raise RuntimeError(f"ERROR IN 'rank_resumes_for_jobs' NODE: {str(e)}")
    
# NODE TO COMPARE RESUMES ACROSS JOBS
def cross_job_comparison(state: MultiJobComparisonState) -> MultiJobComparisonState:
    """COMPARE RESUMES ACROSS JOBS"""
    try:
        print(f"---PERFORMING CROSS-JOB COMPARISON---")

        job_openings = state.get("job_openings", [])
        resumes = state.get("resumes")
        all_rankings = state.get("all_rankings", "")

        # FLATTEN JOB DESCRIPTION AND CANDIDATE RANKING BEFORE PASSING TO CJC AGENT
        flattened_jd_cr =  flatten(all_rankings, job_openings)

        print(f"---INVOKING CROSS-JOB COMPARISON AGENT---")

        # EXTRACT JOB NAMES FROM JOB OPENINGS
        job_names = [job.get("name", f"unknown_job_{i}") for i, job in enumerate(job_openings)]

        # EXTRACT RESUME NAMES FROM RESUMES
        resume_names = [resume.metadata.get('source', f"unknown_resume_{i}") for i, resume in enumerate(resumes)]

        # CREATE FIELDS FOR BEST MATCHES PER JOB DATA MODEL
        best_matches_per_job_fields = {
            clean_fieldname(job_name): (str, Field(..., description=f"Best matching candidate name for: {job_name}"))
            for job_name in job_names
        }

        # CREATE INNER FIELDS FOR BEST MATCHES PER RESUME DATA MODEL
        best_matches_per_resume_fields = {
            clean_fieldname(resume_name): (str, Field(..., description=f"Best matching job opening for resume: {resume_name}"))
            for resume_name in resume_names
        }

        # CREATE DYNAMIC PYDANTIC MODELS
        DynamicBestMatchesPerJob: Type[BaseModel] = create_model(
            "DynamicBestMatchesPerJob",
            **best_matches_per_job_fields
        )

        DynamicBestMatchesPerResume: Type[BaseModel] = create_model(
            "DynamicBestMatchesPerResume",
            **best_matches_per_resume_fields
        )

        # CREATE TEMPORAR WRAPPER MODEL FOR LLM CALL
        DynamicCrossJobMatchResult: Type[BaseModel] = create_model(
            "DynamicCrossJobMatchResult",
            job_resume_matches=(List[JobResumeMatch], Field(
                ..., 
                description="List of detailed matches between each job opening and resume")
            ),
            best_matches_per_job=(DynamicBestMatchesPerJob, Field(
                ..., 
                description="Best candidate identified for each specific job opening"
            )),
            best_matches_per_resume=(DynamicBestMatchesPerResume, Field(
                ...,
                description="Best job opening identified for each specific candidate resume"
            )),
            overall_recommendations=(str, Field(
                ...,
                description="Summary of optimal placements and strategic recommendations and insights"
            ))
        )

        # CREATE AND CHECK IF CJC AGENT CHAIN IS ALREADY CACHED
        if not cache_manager.has("cjc_agent_chain"):
            cache_manager.set("cjc_agent_chain", create_cjc_agent(DynamicCrossJobMatchResult))
        
        # GET CJC AGENT CHAIN
        cjc_agent_chain = cache_manager.get("cjc_agent_chain")

        # RETRY LOGIC
        max_retries = 3
        retry_delay = 2
        cjc_dynamic_result = None

        for attempt in range(max_retries):
            try:
                # INVOKE THE CHAIN
                cjc_dynamic_result = cjc_agent_chain.invoke({"flattened_jd_cr": flattened_jd_cr})
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"---ATTEMPT {attempt + 1} FAILED DURING DYNAIC CJC AGENT INVOCATION, RETRYING...---")
                    time.sleep(retry_delay)
                    continue

                # IF ALL RETRIES FAILED, RE-RAISE THE LAST EXCEPTION
                raise RuntimeError(f"---ERROR IN 'cross_job_comparison' NODE: {str(e)}---")
    
        if cjc_dynamic_result is None:
            raise RuntimeError(f"---FAILED TO GET RESULT FROM CJC AGENT AFTER {max_retries} ATTEMPTS: {str(e)}---")
        
        # CONVERT DYNAMIC RESULT TO FINAL STATE
        print(f"---CONVERTING DYNAMIC RESULT TO FINAL STATE FORMAT---")

        # POST PROCESSING: CONVERT DYNAMIC RESULT BACK TO STANDARD DICTIONARY
        final_best_matches_per_job = {
            original_name: getattr(
                cjc_dynamic_result.best_matches_per_job,
                clean_fieldname(original_name)
            )
            for original_name in job_names
        }

        final_best_matches_per_resume = {
            original_name: getattr(
                cjc_dynamic_result.best_matches_per_resume,
                clean_fieldname(original_name)
            )
            for original_name in resume_names
        }

        final_cjc_result = CrossJobMatchResult(
            job_resume_matches=cjc_dynamic_result.job_resume_matches,
            best_matches_per_job=final_best_matches_per_job,
            best_matches_per_resume=final_best_matches_per_resume,
            overall_recommendation=cjc_dynamic_result.overall_recommendations
        )

        return {
            "job_openings": job_openings,
            "resumes": resumes,
            "all_rankings": all_rankings,
            "final_recommendations": final_cjc_result
        }
    except Exception as e:
        max_retries = 3
        retry_delay = 2
            
        for attempt in range(max_retries):
            try:
                
                # GET CJC AGENT CHAIN
                cjc_agent_chain = cache_manager.get("cjc_agent_chain")

                print(f"---INVOKING CROSS-JOB COMPARISON AGENT---")

                # INVOKE THE CHAIN
                cjc_result = cjc_agent_chain.invoke({"flattened_jd_cr": flattened_jd_cr})

                return {
                    "job_openings": job_openings,
                    "resumes": resumes,
                    "all_rankings": all_rankings,
                    "final_recommendations": cjc_result
                }

            except Exception as e:
                if attempt < max_retries - 1:
                        print(f"Attempt {attempt + 1} failed, retrying...")
                        time.sleep(retry_delay)
                        continue
                raise e

        raise RuntimeError(f"ERROR IN 'cross_job_comparison' NODE: {str(e)}")

# NODES TO CHECK IF ALL JOBS ARE PROCESSED
def are_all_jobs_processed(state: MultiJobComparisonState) -> str:
    """CHECK IF ALL JOBS HAVE BEEN PROCESSED"""
    try:
        job_openings = state.get("job_openings", [])
        # processed_jobs = state.get("processed_job_description", [])
        processed_jobs = []

        for job in job_openings:
            if cache_manager.has(job.get("name")):
                processed_jobs.append(job.get("name"))
        
        # COUNT UNIQUE JOB NAMES IN job_descriptions
        unique_job_names = set(job.get("name", "") for job in job_openings)
        
        # CHECK IF ALL UNIQUE JOBS HAVE BEEN PROCESSED
        all_processed = len(unique_job_names) == len(set(processed_jobs))

        if all_processed:
            cache_manager.clear()
            return "CONTINUE"
        
        return "WAIT"
    except Exception as e:
        raise RuntimeError(f"ERROR IN 'are_all_jobs_processed' NODE: {str(e)}")
        
# CREATE THE MULTI-JOB COMPARISON GRAPH
def create_multi_job_comparison_graph() -> CompiledStateGraph:
    workflow = StateGraph(MultiJobComparisonState)
    
    # ADD NODES
    workflow.add_node("rank_resumes_for_jobs", rank_resumes_for_jobs)
    workflow.add_node("cross_job_comparison", cross_job_comparison)
    
    # ADD EDGES
    workflow.add_edge(START, "rank_resumes_for_jobs")

    # ADD CONDITIONAL EDGE FROM ANALYSIS NODE TO CHECK IF ALL JOBS ARE PROCESSED
    workflow.add_conditional_edges(
            "rank_resumes_for_jobs",
            are_all_jobs_processed,
            {
                "WAIT": "rank_resumes_for_jobs",  # Loop back if not all jobs are processed
                "CONTINUE": "cross_job_comparison"  # Proceed if all jobs are processed
            }
    )

    workflow.add_edge("cross_job_comparison", END)

    print(f"---MULTI-JOB COMPARISON GRAPH COMPILED---")
    
    # COMPILE THE GRAPH
    return workflow.compile()