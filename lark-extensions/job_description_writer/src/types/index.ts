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

 export interface JobStatus {
    trace_id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: Record<string, string>;
    results: any;
    error?: string | null;
  }

export interface StartResponse {
  trace_id: string;
  message: string;
}
  
export interface FileWithContent {
  file: File;
  content: string;
  }

// TYPE FOR EXISTING JOB OPENINGS FETCHED FROM LARK
export interface ExistingJobOpening {
  record_id: string; // RECORD ID
  position: string; // CELL VALUE
  // attachment: FileWithContent
}

/**
 * TYPES FOR RESUME ANALYSIS
 */
export interface JobResumeMatch {
  job_description_name: string;
  candidate_name: string;
  match_score: number;
  match_explanation: string;
}

export interface CrossJobMatchResult {
  job_resume_matches: [JobResumeMatch];
  best_matches_per_job: {};
  best_matches_per_resume: {};
  overall_recommendation: string;
}
    

export default interface RARDataModel {
  job_openings: [];
  resumes: [];
  all_rankings: {};
  final_recommendations: CrossJobMatchResult;
}

export default interface ResumeAnalysisPayload {
  job_description: [JobDescription];
  resumes: { name: string; content: string }[]; // LIST OF RESUMES FOR ANALYSIS
}

export default interface RARJobStatus {
  trace_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: Record<string, string>;
  results: RARDataModel[];
  error?: string | null;
}