export interface JobDescription {
    job_title: string; // GET job_title FIELDS FROM THE API
    job_type: string; // GET job_type FIELD FROM THE API
    department: string; // GET department FIELD FROM THE API
    expiry_date: string; // GET expiry_date FIELD FROM THE API
    job_duties: string; // GET job_duties FIELD FROM THE API
    job_qualification: string //  GET job_qualification FIELD FROM THE API
    expected_start_date: string; // GET expected_start_date FIELD FROM THE API
    job_location: string; // GET job_location FIELD FROM THE API
    finalized_job_description: string; // GET finalized_job_description FIELD FROM THE API
  }
  
  export interface FileWithContent {
    file: File;
    content: string;
  }