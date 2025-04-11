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
RAR_API_URL = os.environ.get("RAR_API_URL", "http://localhost:8080")
RAR_HEADERS = {"DIREC-AI-RAR-API-KEY": str(os.getenv("DIREC_RAR_API_KEY")).strip()}
JDW_API_URL = os.environ.get("JDW_API_URL", "http://localhost:8090")
JDW_HEADERS = {"DIREC-AI-JDW-API-KEY": str(os.getenv("JDW_AGENT_API_KEY")).strip()}

# Initialize session state
if "job_openings" not in st.session_state:
    st.session_state.job_openings = []
if "written_job_descriptions" not in st.session_state:
    st.session_state.written_job_descriptions = []
if "resumes" not in st.session_state:
    st.session_state.resumes = []
if "uploaded_dir" not in st.session_state:
    st.session_state.uploaded_dir = set()
if "results" not in st.session_state:
    st.session_state.results = None
if "job_processing_status" not in st.session_state:
    st.session_state.job_processing_status = {}
    
# API Status flags
if "jdw_api_running" not in st.session_state:
    st.session_state.jdw_api_running = False
if "rar_api_running" not in st.session_state:
    st.session_state.rar_api_running = False
    
# Trace IDs for each API
if "rar_trace_id" not in st.session_state:
    st.session_state.rar_trace_id = None
if "jdw_trace_id" not in st.session_state:
    st.session_state.jdw_trace_id = None

# Functions to interact with the APIs
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

def start_job_description_writing():
    """Start the job description writing process via JDW API"""
    try:
        payload = {
            "job_openings": st.session_state.job_openings
        }
        response = requests.post(f"{JDW_API_URL}/ai/jdw/v1/job_description_writer", json=payload, headers=JDW_HEADERS)
        if response.status_code == 200:
            # Synchronous response
            data = response.json()
            st.session_state.jdw_trace_id = data.get("trace_id")
            st.session_state.jdw_api_running = True
            return True
        else:
            st.error(f"Failed to start job description writing: {response.text}")
            return False
    except Exception as e:
        st.error(f"Error starting job description writing: {str(e)}")
        return False

def start_resume_analysis():
    """Start the resume analysis process via RAR API"""
    try:
        # CONVERT DOCUMENT OBJECTS TO DICTIONARY
        serialized_resumes = []
        for doc in st.session_state.resumes:
            serialized_resumes.append({
                "page_content": doc.page_content,
                "metadata": doc.metadata
            })
        
        # Use written job descriptions if available, otherwise use original job openings
        job_data = st.session_state.written_job_descriptions if st.session_state.written_job_descriptions else st.session_state.job_openings
        
        payload = {
            "job_openings": job_data,
            "resumes": serialized_resumes
        }
        response = requests.post(f"{RAR_API_URL}/ai/rar/v1/analyze_and_rerank", json=payload, headers=RAR_HEADERS)
        if response.status_code == 200:
            # Handle synchronous response
            data = response.json()
            st.session_state.results = data
            return True
        elif response.status_code == 202:
            # Handle asynchronous response
            data = response.json()
            st.session_state.rar_trace_id = data.get("trace_id")
            st.session_state.rar_api_running = True
            return True
        else:
            st.error(f"Failed to start resume analysis: {response.text}")
            return False
    except Exception as e:
        st.error(f"Error starting resume analysis: {str(e)}")
        return False

def check_jdw_status():
    """Check the status of the job description writing task"""
    if not st.session_state.jdw_trace_id:
        return None

    try:
        response = requests.get(f"{JDW_API_URL}/ai/jdw/v1/status/{st.session_state.jdw_trace_id}", headers=JDW_HEADERS)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "completed":
                print(f'---JDW API STATUS: {data.get("status")}---')
                st.session_state.jdw_api_running = False
                # Store the written job descriptions
                job_descriptions = data.get("results", {}).get("job_descriptions", [])
                print(f'---JOB DESCRIPTIONS: {job_descriptions}---')
                if job_descriptions:
                    st.session_state.written_job_descriptions = job_descriptions
                return "completed"
            elif data.get("status") == "running":
                st.session_state.job_processing_status = data.get("progress", {})
                return "running"
            else:
                st.session_state.jdw_api_running = False
                return "failed"
        return None
    except Exception as e:
        st.error(f"Error checking job description status: {str(e)}")
        return None

def check_rar_status():
    """Check the status of the resume analysis task"""
    if not st.session_state.rar_trace_id:
        return None

    try:
        response = requests.get(f"{RAR_API_URL}/ai/rar/v1/status/{st.session_state.rar_trace_id}", headers=RAR_HEADERS)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "completed":
                st.session_state.rar_api_running = False
                st.session_state.results = data.get("results")
                return "completed"
            elif data.get("status") == "running":
                st.session_state.job_processing_status = data.get("progress", {})
                return "running"
            else:
                st.session_state.rar_api_running = False
                return "failed"
        return None
    except Exception as e:
        st.error(f"Error checking resume analysis status: {str(e)}")
        return None

# UI Functions
def render_sidebar():
    with st.sidebar:
        st.title("📄 Resume Matching")
        st.write("Upload job descriptions and resumes to find the best matches.")
        
        # API Status
        rar_api_status = check_rar_api_status()
        jdw_api_status = check_jdw_api_status()
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
        st.sidebar.metric("Written Job Descriptions", len(st.session_state.written_job_descriptions))
        st.sidebar.metric("Resumes", len(st.session_state.resumes))
        
        # Reset button
        if st.sidebar.button("Reset All Data", use_container_width=True):
            st.session_state.job_openings = []
            st.session_state.written_job_descriptions = []
            st.session_state.resumes = []
            st.session_state.uploaded_dir = set()
            st.session_state.results = None
            st.session_state.job_processing_status = {}
            st.session_state.jdw_api_running = False
            st.session_state.rar_api_running = False
            st.session_state.jdw_trace_id = None
            st.session_state.rar_trace_id = None
            st.rerun()

def render_upload_section():
    # JOB DESCRIPTIONS SECTION
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
            new_jobs = []
            for job_file in uploaded_job_files:
                job_desc = process_txt(job_file)
                if job_desc:
                    new_jobs.extend(job_desc)
            
            if new_jobs:
                # Add only new job descriptions
                existing_names = {job['name'] for job in st.session_state.job_openings}
                for job in new_jobs:
                    if job['name'] not in existing_names:
                        st.session_state.job_openings.append(job)
                        existing_names.add(job['name'])
            
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
    
    # JOB DESCRIPTION WRITING SECTION
    st.subheader("Step 2: Write Job Descriptions")
    
    jdw_col1, jdw_col2 = st.columns([1, 2])
    
    with jdw_col1:
        start_jdw_disabled = len(st.session_state.job_openings) == 0 or st.session_state.jdw_api_running
        if st.button("Write Job Descriptions", disabled=start_jdw_disabled, use_container_width=True):
            if len(st.session_state.job_openings) == 0:
                st.error("Please upload job descriptions first.")
            else:
                with st.spinner("Starting job description writing..."):
                    if start_job_description_writing():
                        st.success("Job description writing started!")
                        st.rerun()
    
    with jdw_col2:
        # Show status if job description writing is in progress
        if st.session_state.jdw_api_running:
            st.info("Job description writing in progress...")
            
            # Check status
            jdw_status = check_jdw_status()
            if jdw_status == "completed":
                st.success("Job descriptions written successfully!")
            elif jdw_status == "failed":
                st.error("Job description writing failed.")
            
            # Show progress
            for job_name, status in st.session_state.job_processing_status.items():
                if status == "completed":
                    st.success(f"✓ {job_name} processed")
                else:
                    st.warning(f"⟳ Processing {job_name}...")
    
    # Show written job descriptions if available
    if st.session_state.written_job_descriptions:
        with st.expander("View Written Job Descriptions", expanded=False):
            for i, job in enumerate(st.session_state.written_job_descriptions):
                st.markdown(f"#### {job.get('job_title', 'Job ' + str(i+1))}")
                st.write(job.get('finalized_job_description', 'No description available'))
                st.divider()
    
    # RESUME UPLOAD SECTION
    st.subheader("Step 3: Upload Resumes")
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
            
            # Process and add new resumes
            new_resumes = process_pdfs(uploaded_files)
            existing_sources = {doc.metadata['source'] for doc in st.session_state.resumes}
            
            for resume in new_resumes:
                if resume.metadata['source'] not in existing_sources:
                    st.session_state.resumes.append(resume)
                    existing_sources.add(resume.metadata['source'])
                
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
    if st.session_state.job_openings or st.session_state.written_job_descriptions or st.session_state.resumes:
        st.header("Uploaded Files")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.subheader("Original Job Descriptions")
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
            st.subheader("Written Job Descriptions")
            if st.session_state.written_job_descriptions:
                for i, job in enumerate(st.session_state.written_job_descriptions):
                    # print(st.session_state.written_job_descriptions)
                    with st.expander(f"{job.get('job_title', 'Job ' + str(i+1))}", expanded=False):
                        st.write("Content", job.get('finalized_job_description', 'No description'), height=200, key=f"written_job_{i}", disabled=True)
                        if st.button("Remove", key=f"remove_written_job_{i}"):
                            # Remove the job from the written list
                            st.session_state.written_job_descriptions.pop(i)
                            st.rerun()
            else:
                st.info("No written job descriptions yet.")

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
    st.header("Run Resume Analysis")
    
    # Check whether to enable the resume analysis button
    # Should be enabled only if:
    # 1. Job descriptions are available (either original or written)
    # 2. Resumes are available
    # 3. Job description writing is not in progress
    # 4. Resume analysis is not in progress
    
    jobs_available = len(st.session_state.job_openings) > 0 or len(st.session_state.written_job_descriptions) > 0
    resumes_available = len(st.session_state.resumes) > 0
    disable_analysis = not jobs_available or not resumes_available or st.session_state.jdw_api_running or st.session_state.rar_api_running
    
    start_col, status_col = st.columns([1, 2])
    
    with start_col:
        if st.button("Start Resume Analysis", disabled=disable_analysis, use_container_width=True):
            # Start the resume analysis
            with st.spinner("Starting resume analysis..."):
                if start_resume_analysis():
                    st.success("Resume analysis started!")
                    st.rerun()
    
    with status_col:
        if st.session_state.rar_api_running:
            st.info("Resume analysis in progress...")
            
            # Check status
            rar_status = check_rar_status()
            if rar_status == "completed":
                st.success("Resume analysis completed successfully!")
            elif rar_status == "failed":
                st.error("Resume analysis failed.")
            
            # Show progress
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
    
    **Workflow:**
    1. Upload job descriptions
    2. Write formal job descriptions using AI
    3. Upload resumes
    4. Analyze and rank resumes against job descriptions
    """)
    st.info("This app uses AI-powered LangGraph applications to process job descriptions and analyze resumes.")

    # Render sidebar
    render_sidebar()

    # Check API status and handle accordingly
    if st.session_state.jdw_api_running:
        jdw_status = check_jdw_status()
        if jdw_status == "completed":
            st.success("Job descriptions written successfully!")
            st.session_state.jdw_api_running = False
            st.rerun()
        elif jdw_status == "failed":
            st.error("Job description writing failed.")
            st.session_state.jdw_api_running = False
    
    if st.session_state.rar_api_running:
        rar_status = check_rar_status()
        if rar_status == "completed":
            st.success("Resume analysis completed successfully!")
            st.session_state.rar_api_running = False
            st.rerun()
        elif rar_status == "failed":
            st.error("Resume analysis failed.")
            st.session_state.rar_api_running = False
    
    # Render main sections
    render_upload_section()
    render_job_and_resume_list()
    render_analysis_button()
    render_results()
    
    # Auto-refresh while any API is running
    if st.session_state.jdw_api_running or st.session_state.rar_api_running:
        time.sleep(2)
        st.rerun()

if __name__ == "__main__":
    main()