import streamlit as st
import os
import glob
import time
import requests
import pandas as pd
import plotly.express as px
from dotenv import load_dotenv
from pathlib import Path

# INTERNAL IMPORTS
from utils import process_directory, process_pdfs, process_txt

load_dotenv(Path(".env"))

# Page configuration
st.set_page_config(
    page_title="AI-Powered Resume Analyzer-Reranker Tool",
    page_icon="📄",
    layout="wide"
)

# API ENDPOINTS & HEADERS
RAR_API_URL = os.environ.get("RAR_API_URL", "http://localhost:8080") # Corrected Env Var Name
RAR_HEADERS = {"DIREC-AI-RAR-API-KEY": str(os.getenv("DIREC_RAR_API_KEY")).strip()} # Corrected Header Key and Env Var Name
JDW_API_URL = os.environ.get("JDW_API_URL", "http://localhost:8090")
JDW_HEADERS = {"DIREC-AI-JDW-API-KEY": "jdw_d39_8bb3_4795_ae2e_a8ab6b526210"}

# Initialize session state
if "job_openings" not in st.session_state:
    st.session_state.job_openings = []
if "written_job_openings" not in st.session_state:
    st.session_state.written_job_openings = []
if "resumes" not in st.session_state:
    st.session_state.resumes = []
if "uploaded_dir" not in st.session_state:
    st.session_state.uploaded_dir = set()
if "results" not in st.session_state:
    st.session_state.results = None
if "job_processing_status" not in st.session_state:
    st.session_state.job_processing_status = {}
if "api_running" not in st.session_state:
    st.session_state.api_running = False
if "rar_trace_id" not in st.session_state:
    st.session_state.rar_trace_id = None
if "jdw_trace_id" not in st.session_state:
    st.session_state.jdw_trace_id = None

# Functions to interact with the API
def check_rar_api_status():
    try:
        response = requests.get(f"{RAR_API_URL}/ai/rar/v1/health", headers=RAR_HEADERS)
        return response.status_code == 200
    except:
        return False
    
def check_jdw_api_status():
    try:
        response = requests.get(f"{JDW_API_URL}/ai/jdw/v1/health", headers=JDW_HEADERS)
        return response.status_code == 200
    except:
        return False

def start_analysis():
    try:
        # CONVERT DOCUMENT OBJECTS TO DICTIONARY
        serialized_resumes = []
        for doc in st.session_state.resumes:
            serialized_resumes.append({
                "page_content": doc.page_content,
                "metadata": doc.metadata
            })
        
        payload = {
            "job_openings": st.session_state.job_openings,
            "resumes": serialized_resumes
        }
        response = requests.post(f"{RAR_API_URL}/ai/rar/v1/analyze_and_rerank", json=payload, headers=RAR_HEADERS)
        if response.status_code == 202:
            data = response.json()
            st.session_state.rar_trace_id = data.get("trace_id") # Use rar_trace_id
            st.session_state.api_running = True # Consider separate flags if JDW becomes async
            return True
        else:
            st.error(f"Failed to start analysis: {response.text}")
            return False
    except Exception as e:
        raise RuntimeError(f"Error starting analysis: {str(e)}")

def start_rewriting_job_descriptions():
    try:
        payload = {
            "job_openings": st.session_state.job_openings
        }
        response = requests.post(f"{JDW_API_URL}/ai/jdw/v1/job_description_writer", json=payload, headers=JDW_HEADERS)
        if response.status_code == 202:
            data = response.json()
            st.session_state.jdw_trace_id = data.get("trace_id")
            st.session_state.api_running = True
            return True
        else:
            st.error(f"Failed to start rewriting job descriptions: {response.text}")
            return False
    except Exception as e:
        raise RuntimeError(f"Error starting rewriting job descriptions: {str(e)}")

def check_analysis_status():
    if not st.session_state.rar_trace_id:
        return None

    try:
        # Added headers=RAR_HEADERS
        response = requests.get(f"{RAR_API_URL}/ai/rar/v1/status/{st.session_state.rar_trace_id}", headers=RAR_HEADERS)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "completed":
                st.session_state.api_running = False
                st.session_state.results = data.get("results")
                return "completed"
            elif data.get("status") == "running":
                st.session_state.job_processing_status = data.get("progress", {})
                return "running"
            else:
                st.session_state.api_running = False
                return "failed"
        return None
    except:
        return None

def check_written_job_status():
    if not st.session_state.jdw_trace_id:
        return None

    try:
        # Added headers=JDW_HEADERS
        response = requests.get(f"{JDW_API_URL}/ai/jdw/v1/status/{st.session_state.jdw_trace_id}", headers=JDW_HEADERS)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "completed":
                st.session_state.api_running = False
                st.session_state.written_job_openings = data.get("results")
                return "completed"
            elif data.get("status") == "running":
                st.session_state.job_processing_status = data.get("progress", {})
                return "running"
            else:
                st.session_state.api_running = False
                return "failed"
        return None
    except:
        return None

# UI Functions
def render_sidebar():
    with st.sidebar:
        st.title("📄 Resume Matching")
        st.write("Upload job descriptions and resumes to find the best matches.")
        
        # API Status
        rar_api_status = check_rar_api_status()
        jdw_api_status = check_jdw_api_status() # Assuming a similar health check exists or will be added for JDW
        st.sidebar.markdown("### API Status")
        
        # Display status for RAR API
        if rar_api_status:
            st.sidebar.success(f"RAR API Connected ({RAR_API_URL})")
        else:
            st.sidebar.error(f"RAR API Disconnected ({RAR_API_URL})")

        # Display status for JDW API
        if jdw_api_status:
            st.sidebar.success(f"JDW API Connected ({JDW_API_URL})")
        else:
            st.sidebar.error(f"JDW API Disconnected ({JDW_API_URL})")
            st.sidebar.info(f"Ensure APIs are running.")

        # Stats
        st.sidebar.markdown("### Statistics")
        st.sidebar.metric("Job Descriptions", len(st.session_state.job_openings))
        st.sidebar.metric("Resumes", len(st.session_state.resumes))
        
        # Reset button
        if st.sidebar.button("Reset All Data", use_container_width=True):
            st.session_state.job_openings = []
            st.session_state.resumes = []
            st.session_state.uploaded_dir = set()
            st.session_state.results = None
            st.session_state.job_processing_status = {}
            st.session_state.api_running = False
            st.session_state.trace_id = None
            st.rerun()

def display_written_job_descriptions():
    if st.session_state.written_job_openings:
        st.subheader("Rewritten Job Descriptions")
        for job in st.session_state.written_job_openings:
            with st.expander(f"{job['job_title']}", expanded=False):
                st.text_area("Content", job['job_description'], height=200, key=f"written_job_{job['job_title']}", disabled=True)


def render_upload_section():
    st.subheader("Step 1: Upload Job Descriptions")
    job_description_option = st.radio(
        "Choose Job Description Upload Method",
        ("Upload individual TXT files", "Upload a folder of TXT files"),
        key="multi_job_upload_option"
    )

    if job_description_option == "Upload individual TXT files":
        uploaded_job_files = st.file_uploader(
            "Upload job description TXT files",
            type=["txt"],
            accept_multiple_files=True,
            help="Upload multiple .txt files containing job descriptions",
            key="multi_job_uploader"
        )

        if uploaded_job_files:
            for job_file in uploaded_job_files:
                job_desc = process_txt(job_file)
                if job_desc:
                    st.session_state.job_openings.extend(job_desc)
            
        
    else:  # UPLOAD FOLDER OPTION
        upload_dir = st.text_input(
            "Enter the path to directory containing job description TXT files:",
            help="Example: /path/to/job_descriptions",
            key="multi_job_dir_input"
        )
        if upload_dir and os.path.isdir(upload_dir): 
            
            # CHECK IF DIRECTORY IS STILL NOT PROCESSED
            if upload_dir not in st.session_state.uploaded_dir:
                st.session_state.job_openings.extend(process_directory(directory_path=upload_dir, file_content="job_description"))
                st.session_state.uploaded_dir.add(upload_dir)
            
            st.success(f"Directory found: {upload_dir}")
            st.info(f"{len(st.session_state.job_openings)} TXT files found in the directory")
        elif upload_dir:
            st.error(f"Directory not found: {upload_dir}")
    
    # USE EXTERNAL API TO REWRITE JOB DESCRIPTIONS
    st.subheader("Step 1.5: Write Job Descriptions")
    if st.button("Write Job Descriptions", disabled=len(st.session_state.job_openings) == 0, use_container_width=True):
        if len(st.session_state.job_openings) == 0:
            st.error("Please provide job descriptions first.")
        else:
            with st.spinner("Rewriting job descriptions..."):
                try:
                    jdw_payload = {
                        "job_openings": st.session_state.job_openings
                    }

                    # SEND REQUEST TO JDW AGENT - Use JDW_API_URL and JDW_HEADERS
                    response = requests.post(f"{JDW_API_URL}/ai/jdw/v1/job_description_writer", json=jdw_payload, headers=JDW_HEADERS)

                    # Check for 202 Accepted for async start, or 200 for sync result
                    if response.status_code == 202: # Assuming JDW writer is also async now
                        data = response.json()
                        st.session_state.jdw_trace_id = data.get("trace_id") # Store JDW trace ID
                        st.info("Job description rewriting started...")
                        # Need to implement polling for JDW status similar to RAR
                        # For now, just indicate start
                        st.rerun()
                    elif response.status_code == 200: # Handle potential synchronous response
                        data = response.json()
                        st.session_state.written_job_openings = data.get("job_openings", [])
                        st.json(data)
                        st.success("Job descriptions rewritten successfully!")
                        st.rerun()
                    else:
                        st.error(f"Failed to rewrite job descriptions: {response.text}")
                except Exception as e:
                    st.error(f"Error calling JDW API: {str(e)}")

    # Resume upload
    st.subheader("Step 2: Upload Resumes")
    resume_upload_option = st.radio(
        "Choose upload method:",
        ("Upload individual PDF files", "Upload a folder of PDF files"),
        key="multi_resume_upload_option"
    )
        
    if resume_upload_option == "Upload individual PDF files":
        uploaded_files = st.file_uploader(
            "Upload resume PDF files", 
            type="pdf", 
            accept_multiple_files=True,
            key="multi_resume_uploader"
        )
            
        if uploaded_files:
            st.success(f"{len(uploaded_files)} files uploaded")
            st.session_state.resumes.extend(process_pdfs(uploaded_files))
                
    else:  # Upload folder option
        upload_dir = st.text_input(
            "Enter the path to directory containing resume PDFs:",
            help="Example: /path/to/resumes",
            key="multi_resume_dir_input"
        )
            
        if upload_dir and os.path.isdir(upload_dir):

            if upload_dir not in st.session_state.uploaded_dir:
                st.session_state.resumes.extend(process_directory(directory_path=upload_dir, file_content="resume"))
                st.session_state.uploaded_dir.add(upload_dir)

            st.success(f"Directory found: {upload_dir}")
            st.info(f"{len(st.session_state.resumes)} PDF files found in the directory")
        elif upload_dir:
            st.error(f"Directory not found: {upload_dir}")

def render_job_and_resume_list():
    if st.session_state.job_openings or st.session_state.resumes:
        st.header("Uploaded Files")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.subheader("Job Descriptions")
            if st.session_state.job_openings:
                # Create a set to track unique job descriptions by name
                unique_jobs = {}
                for job in st.session_state.job_openings:
                    # Use the job name as the key, only keeping the last occurrence
                    unique_jobs[job['name']] = job
                
                # Display only the unique jobs
                for i, (name, job) in enumerate(unique_jobs.items()):
                    with st.expander(f"{name}", expanded=False):
                        st.text_area("Content", job["content"], height=200, key=f"job_{i}", disabled=True)
                        if st.button("Remove", key=f"remove_job_{i}"):
                            # Remove the job from the original list
                            st.session_state.job_openings = [j for j in st.session_state.job_openings if j['name'] != name]
                            st.rerun()
            else:
                st.info("No job descriptions uploaded yet.")
        
        with col2:
            st.subheader("Rewritten Job Descriptions")
            if st.session_state.written_job_openings:
                # CREATE A UNIQUE SET OF JOB DESCRIPTIONS BY JOB TITLE
                unique_jd = {}
                for job in st.session_state.written_job_openings:
                    unique_jd[job['job_title']] = job['job_description']
                
                # DISPLAY ONLY THE UNIQUE REWRITTEN JOB DESCRIPTIONS
                for i, (title, description) in enumerate(unique_jd.items()):
                    with st.expander(f"{title}", expanded=False):
                        st.text_area("Content", description, height=200, key=f"written_job_{i}", disabled=True)
                        if st.button("Remove", key=f"remove_written_job_{i}"):
                            # Remove the job from the original list
                            st.session_state.written_job_openings = [j for j in st.session_state.written_job_openings if j['job_title'] != title]
                            st.rerun()

        with col3:
            st.subheader("Resumes")
            if st.session_state.resumes:
                # Create a set to track unique resumes by filename
                unique_resumes = {}
                for resume in st.session_state.resumes:
                    # Use the source filename as the key
                    source = resume.metadata['source']
                    unique_resumes[source] = resume
                
                # Display only the unique resumes
                for i, (source, resume) in enumerate(unique_resumes.items()):
                    with st.expander(f"{source}", expanded=False):
                        st.text_area("Content", resume.page_content, height=200, key=f"resume_{i}", disabled=True)
                        if st.button("Remove", key=f"remove_resume_{i}"):
                            # Remove the resume from the original list
                            st.session_state.resumes = [r for r in st.session_state.resumes if r.metadata['source'] != source]
                            st.rerun()
            else:
                st.info("No resumes uploaded yet.")

def render_analysis_button():
    st.header("Run Analysis")
    
    start_col, status_col = st.columns([1, 2])
    
    with start_col:
        if st.button("Start Analysis", disabled=st.session_state.api_running or len(st.session_state.job_openings) == 0 or len(st.session_state.resumes) == 0, use_container_width=True):
            start_analysis()
            st.rerun()
    
    with status_col:
        if st.session_state.api_running:
            status_placeholder = st.empty()
            status_placeholder.info("Analysis in progress...")
            
            # Add progress bars for jobs being processed
            for job_name, status in st.session_state.job_processing_status.items():
                if status == "completed":
                    st.success(f"✓ {job_name} processed")
                else:
                    st.warning(f"⟳ Processing {job_name}...")

def render_results():
    if st.session_state.results:
        st.header("Analysis Results")
        
        results = st.session_state.results
        
        # Create tabs for different views
        tab1, tab2, tab3 = st.tabs(["Best Matches", "Rankings by Job", "Cross-Job Analysis"])
        
        with tab1:
            st.subheader("Best Matches")
            
            # Best matches per job
            st.markdown("#### Best Candidate for Each Job")
            best_matches_per_job = results.get("final_recommendations", {}).get("best_matches_per_job")
            
            if best_matches_per_job:
                best_job_df = pd.DataFrame([
                    {"Job": job, "Best Candidate": candidate} 
                    for job, candidate in best_matches_per_job.items()
                ])
                st.dataframe(best_job_df, use_container_width=True)
            else:
                st.info("No best matches per job found.")
            
            # Best matches per resume
            st.markdown("#### Best Job for Each Candidate")
            best_matches_per_resume = results.get("final_recommendations", {}).get("best_matches_per_resume")
            
            if best_matches_per_resume:
                best_resume_df = pd.DataFrame([
                    {"Candidate": candidate, "Best Job": job} 
                    for candidate, job in best_matches_per_resume.items()
                ])
                st.dataframe(best_resume_df, use_container_width=True)
            else:
                st.info("No best matches per candidate found.")
        
        with tab2:
            st.subheader("Rankings by Job")
            
            # Display rankings for each job
            all_rankings = results.get("all_rankings", {})
            
            if all_rankings:
                job_selector = st.selectbox("Select Job", list(all_rankings.keys()))
                
                if job_selector:
                    job_rankings = all_rankings[job_selector]
                    
                    # Create a DataFrame for the selected job
                    rankings_data = []
                    for rank, candidate in enumerate(job_rankings):
                        rankings_data.append({
                            "Rank": rank + 1,
                            "Candidate": candidate.get("candidate_name", "Unknown"),
                            "Total Score": candidate.get("total_score", 0),
                            "Key Strengths": ", ".join(candidate.get("key_strengths", [])),
                            "Areas for Improvement": ", ".join(candidate.get("areas_for_improvement", []))
                        })
                    
                    rankings_df = pd.DataFrame(rankings_data)
                    st.dataframe(rankings_df, use_container_width=True)
                    
                    # Detailed view of selected candidate
                    st.markdown("#### Candidate Details")
                    candidate_selector = st.selectbox(
                        "Select Candidate", 
                        [candidate.get("candidate_name", "Unknown") for candidate in job_rankings]
                    )
                    
                    if candidate_selector:
                        selected_candidate = next(
                            (c for c in job_rankings if c.get("candidate_name") == candidate_selector), 
                            None
                        )
                        
                        if selected_candidate:
                            st.markdown("##### Analysis")
                            st.write(selected_candidate.get("analysis"))
                            
                            st.markdown("##### Scores")
                            scores = selected_candidate.get("scores", {})
                            
                            # Create bar chart for scores
                            if scores:
                                score_df = pd.DataFrame([
                                    {"Category": category, "Score": score} 
                                    for category, score in scores.items()
                                ])
                                
                                fig = px.bar(
                                    score_df, 
                                    x="Category", 
                                    y="Score",
                                    title="Candidate Scores by Category",
                                    color="Score",
                                    color_continuous_scale="Viridis",
                                    range_color=[0, 10]
                                )
                                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("No rankings available.")
        
        with tab3:
            st.subheader("Cross-Job Analysis")
            
            # Display the overall recommendation
            overall_recommendation = results.get("final_recommendations", {}).get("overall_recommendation")
            if overall_recommendation:
                st.markdown("#### Overall Recommendation")
                st.info(overall_recommendation)
            
            # Display job-resume matches
            job_resume_matches = results.get("final_recommendations", {}).get("job_resume_matches", [])
            
            if job_resume_matches:
                st.markdown("#### Job-Resume Match Scores")
                
                # Create a DataFrame for the matches
                matches_data = []
                for match in job_resume_matches:
                    matches_data.append({
                        "Job": match.get("job_description_name", "Unknown"),
                        "Candidate": match.get("candidate_name", "Unknown"),
                        "Match Score": match.get("match_score", 0),
                        "Match Explanation": match.get("match_explanation", "")
                    })
                
                matches_df = pd.DataFrame(matches_data)
                
                # Create a heatmap of job-candidate matches
                pivot_df = matches_df.pivot(index="Candidate", columns="Job", values="Match Score")
                
                fig = px.imshow(
                    pivot_df,
                    labels=dict(x="Job", y="Candidate", color="Match Score"),
                    x=pivot_df.columns,
                    y=pivot_df.index,
                    color_continuous_scale="Viridis",
                    title="Job-Candidate Match Heatmap"
                )
                
                st.plotly_chart(fig, use_container_width=True)
                
                # Display the detailed match table
                st.dataframe(
                    matches_df, 
                    column_config={
                        "Match Score": st.column_config.ProgressColumn(
                            "Match Score",
                            help="Match score between candidate and job",
                            format="%.2f",
                            min_value=0,
                            max_value=1,
                        ),
                    },
                    use_container_width=True
                )
            else:
                st.info("No job-resume matches available.")

def main():
    # Application title and description
    st.title("🤖 AI-Powered Resume Analyzer-Reranker Tool")
    st.markdown("""
    This application analyzes resumes/CVs and ranks them based on a job posting using AI.
    """)
    st.info("This app uses Groq API, LangChain, LangGraph, and models from LLaMA and MistralAI to analyze and rank resumes.")

    # RENDER SIDEBAR
    render_sidebar()

    # Check if analysis is running
    if st.session_state.api_running:
        status = check_analysis_status()
        if status == "completed":
            st.success("Analysis completed successfully!")
        elif status == "failed":
            st.error("Analysis failed. Please try again.")
    
    # Render main sections
    render_upload_section()
    render_job_and_resume_list()
    render_analysis_button()
    render_results()
    
    # Auto-refresh while analysis is running
    if st.session_state.api_running:
        time.sleep(2)
        st.rerun()

if __name__ == "__main__":
    main()
    # create_main_layout()
