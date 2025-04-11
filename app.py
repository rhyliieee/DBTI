import streamlit as st
from datetime import datetime

# Preprocessing function to compile job description data
def compile_job_description(job_title, job_location, job_type, department, expiry_date, job_description):
    return f"""Job Title: {job_title}
Job Location: {job_location}
Job Type: {job_type}
Department: {department}
Job Expiry Date: {expiry_date}

Job Description: 
{job_description}
"""

# FUNCTION TO INITIALIZE LARK CLIENT
# def init_lark_client(auth_code):
    # INITIALIZE LARK CLIENT


# Streamlit UI components
st.title("Job Jigsaw - Job Posting Form")



# Textbox for Job Title
job_title = st.text_input("Job Title")

# GET AUTHORIZATION CODE FROM LARK BASE
auth_code = st.text_input("Enter Authorization Code", type="password")

# Dropdown for Department
department = st.selectbox("Department", ["Engineering", "Marketing", "Sales", "HR", "Finance"])

# Textbox for Job Expiry Date with calendar picker
expiry_date = st.date_input("Job Expiry Date", min_value=datetime.today())

# Radio button for Job Location
job_location = st.radio("Job Location", ["Onsite", "Remote", "Hybrid"])

# Radio button for Job Type
job_type = st.radio("Job Type", ["Part-time", "Internship", "Fulltime"])

# Text Area for Job Description
job_description = st.text_area("Job Description")

# Video file uploader for MP4 videos
video_file = st.file_uploader("Upload a video (MP4 format)", type=["mp4"])

# Button to send compiled job description
if st.button("Send Compiled Job Description"):
    if job_title and department and expiry_date and job_location and job_type and job_description:
        compiled_data = compile_job_description(
            job_title, job_location, job_type, department, expiry_date, job_description
        )
        st.success("Job Description Compiled Successfully!")
        st.text_area("Compiled Job Description", compiled_data, height=200)
    else:
        st.error("Please fill out all fields before submitting.")