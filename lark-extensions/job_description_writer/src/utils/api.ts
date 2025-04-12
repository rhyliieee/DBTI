import { 
  FileWithContent, 
  JobStatus, 
  StartResponse, 
  RARDataModel, 
  JobDescription,
  RaRJobStatus,
  ResumeAnalysisPayload
} from '../types';
import axios from 'axios';

/**
 * Retrieves API configuration from environment variables with defaults.
 * @returns {object} Object containing API URL, header name, and key.
 * @throws {Error} If required environment variables are missing.
 */
function getJDWAPIConfig() {
  const apiHeaderName = process.env.JDW_HEADER_NAME || 'DIREC-AI-JDW-API-KEY';
  const apiURL = process.env.JDW_API_URL || 'http://localhost:8090';
  const apiKey = process.env.JDW_API_KEY || 'jdw_d39_8bb3_4795_ae2e_a8ab6b526210'; 

  // Basic validation - ensure essential config is present
  if (!apiHeaderName || !apiURL || !apiKey) {
      console.error('API configuration is incomplete. Check environment variables JDW_HEADER_NAME, JDW_API_URL, JDW_API_KEY.');
      throw new Error('API configuration is incomplete.');
  }

  return { apiURL, apiHeaderName, apiKey };
}


/**
 * Performs a health check on the JDW API endpoint.
 * @returns {Promise<any>} The response data from the health check endpoint.
 * @throws {Error} If the API call fails or returns an unhealthy status.
 */
export async function apiJDWHealthCheck(): Promise<any> {
  try {
    const { apiURL, apiHeaderName, apiKey } = getJDWAPIConfig();
    console.log(`Performing health check on: ${apiURL}/ai/jdw/v1/health`);
    
    // CALL THE API TO CHECK HEALTH STATUS
    const response = await axios.get(
      `${apiURL}/ai/jdw/v1/health`,
      {
        headers: {
          [apiHeaderName]: apiKey,
          'Accept': 'application/json',
        }
      }
    )
    console.log(`---RESPONSE FROM THE API: ${response.status}---`)
    console.log(`---RESPONSE DATA: ${JSON.stringify(response.data)}---`)
    
    // Check if the response indicates success (e.g., status 200 and data.status === 'ok')
    if (response.status !== 200 || response.data?.status !== 'ok') {
      throw new Error(`API health check failed or returned unexpected status: ${response.statusText}`);
  }

  return response.data; 
  } catch (error: any) {
    console.error('Error checking API health:', error.response?.data || error.message);
    throw new Error(`Failed to check API health. Please ensure the API is running and configuration is correct. Details: ${error.message}`);
  }
}

/**
 * Initiates the job description writing process by sending files to the API.
 * @param {FileWithContent[]} files - An array of file objects with their content.
 * @returns {Promise<StartResponse>} An object containing the trace_id for the initiated job.
 * @throws {Error} If the API call fails.
 */
export async function startJDWriter(files: FileWithContent[]): Promise<StartResponse> {
  try {
    // GET API CONFIGURATION
    const { apiURL, apiHeaderName, apiKey } = getJDWAPIConfig();
    console.log(`Initiating job description processing at: ${apiURL}/ai/jdw/v1/job_description_writer`);

    // Convert files to the required format: List[Dict[str, str]]
    const filesData = await Promise.all(files.map(async (fileWithContent) => {
        // Ensure content is read as text. If content is already available, use it directly.
        const content = typeof fileWithContent.content === 'string'
            ? fileWithContent.content
            : await fileWithContent.file.text(); // Fallback to reading if content isn't pre-loaded
        return {
            name: fileWithContent.file.name, // Use the actual file name
            content: content
        };
    }));

    console.log('--- Files to be processed: ', filesData.map(f => f.name));
    
    // CALL THE API TO SEND REQUEST
    const response = await axios.post<StartResponse>(
      `${apiURL}/ai/jdw/v1/job_description_writer`,
      {job_openings: filesData},
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          [apiHeaderName]: apiKey
        }
      }
    );

    // console.log(`--- Job Initiation API Response Status: ${response.status} ---`);
    console.log(`--- Job Initiation API Response Data:`, response.data, '---');

    // Basic validation of the response structure
    if (!response.data || !response.data.trace_id) {
        throw new Error('API response did not include a trace_id.');
    }

    return response.data; // Return the parsed JSON response { trace_id: "...", message: "..." }
  } catch (error: any) {
    console.error('Error processing job descriptions:', error.response?.data || error.message);
    throw new Error(`Failed to initiate job description processing. Details: ${error.message}`);
  }
}

/**
 * Checks the status of a specific job using its trace ID.
 * @param {string} traceId - The unique identifier for the job.
 * @returns {Promise<JobStatus>} An object containing the current status, progress, and results (if completed).
 * @throws {Error} If the API call fails or the job is not found.
 */
export async function checkJDWStatus(traceId: string): Promise<JobStatus> {
  if (!traceId) {
    throw new Error('Trace ID is required to check job status.');
  }
  try {
    const { apiURL, apiHeaderName, apiKey } = getJDWAPIConfig();
    console.log(`Checking job status for trace ID: ${traceId} at: ${apiURL}/ai/jdw/v1/status/${traceId}`);

    const response = await axios.get<JobStatus>(
      `${apiURL}/ai/jdw/v1/status/${traceId}`,
      {
        headers: {
          [apiHeaderName]: apiKey,
          'Accept': 'application/json',
        }
      }
    );

    console.log(`--- Job Status API Response Status: ${response.status} ---`);
    // console.log(`---JOB STATUS API RESPONSE DATA: ${JSON.stringify(response.data)}---`);

    // Validate the response structure based on JobStatus interface
     if (!response.data || typeof response.data.status !== 'string') {
        console.error("Invalid status response structure:", response.data);
        throw new Error('Received invalid status response from API.');
    }

    return response.data; // Return the parsed JSON response
  } catch (error: any) {
    console.error(`Error checking job status for trace ID ${traceId}:`, error.response?.data || error.message);
    if (error.response?.status === 404) {
        throw new Error(`Job with trace ID ${traceId} not found.`);
    }
    throw new Error(`Failed to check job status for trace ID ${traceId}. Details: ${error.message}`);
  }
}



/**
 * GET API CONFIG FOR RESUME ANALYSIS
 */
function getRARAPIConfig() {
  const apiHeaderName = process.env.RAR_HEADER_NAME || 'DIREC-AI-RAR-API-KEY';
  const apiURL = process.env.RAR_API_URL || 'http://localhost:8080';
  const apiKey = process.env.RAR_API_KEY || 'rar_c1a09171_ed574d67_af76_23b2b129b8'; 

  // Basic validation - ensure essential config is present
  if (!apiHeaderName || !apiURL || !apiKey) {
      console.error('API configuration is incomplete. Check environment variables RAR_HEADER_NAME, RAR_API_URL, RAR_API_KEY.');
      throw new Error('API configuration is incomplete.');
  }

  return { apiURL, apiHeaderName, apiKey };
}

/**
 * Performs a health check on the RAR API endpoint.
 * @returns {Promise<any>} The response data from the health check endpoint.
 * @throws {Error} If the API call fails or returns an unhealthy status.
 */
export async function apiRARHealthCheck(): Promise<any> {
  try {
    const { apiURL, apiHeaderName, apiKey } = getRARAPIConfig();
    console.log(`Performing health check on: ${apiURL}/ai/rar/v1/health`);
    
    // CALL THE API TO CHECK HEALTH STATUS
    const response = await axios.get(
      `${apiURL}/ai/rar/v1/health`,
      {
        headers: {
          [apiHeaderName]: apiKey,
          'Accept': 'application/json',
        }
      }
    )
    console.log(`---RESPONSE FROM THE API: ${response.status}---`)
    console.log(`---RESPONSE DATA: ${JSON.stringify(response.data)}---`)
    
    // Check if the response indicates success (e.g., status 200 and data.status === 'ok')
    if (response.status !== 200 || response.data?.status !== 'ok') {
      throw new Error(`API health check failed or returned unexpected status: ${response.statusText}`);
  }

  return response.data; 
  } catch (error: any) {
    console.error('Error checking API health on RAR Endpoint:', error.response?.data || error.message);
    throw new Error(`Failed to check API health on RAR Endpoint. Please ensure the API is running and configuration is correct. Details: ${error.message}`);
  }
}

/**
 * Initiates the job description writing process by sending files to the API.
 * @param {FileWithContent[]} files - An array of file objects with their content.
 * @returns {Promise<StartResponse>} An object containing the trace_id for the initiated job.
 * @throws {Error} If the API call fails.
 */
export async function startResumeAnalysis(
  selectedJob: JobDescription[],
  resumeFiles: FileWithContent[]
): Promise<StartResponse> {
  try {
    // GET API CONFIGURATION
    const { apiURL, apiHeaderName, apiKey } = getRARAPIConfig();
    console.log(`Initiating Resume Analysis at: ${apiURL}/ai/rar/v1/analyze_and_rerank`);

    const resumesData = await Promise.all(resumeFiles.map(async (fileWithContent) => {
        const content = typeof fileWithContent.content === 'string'
            ? fileWithContent.content
            // Resume content might need specific handling (e.g., base64 for PDFs if API expects that)
            // For now, assuming text content or adjust as needed by the API.
            // If PDFs need to be sent as binary/base64, conversion logic is needed here.
            : await fileWithContent.file.text(); // Placeholder: Read as text, might need adjustment for PDF
        return {
            name: fileWithContent.file.name,
            content: content // Adjust content format if API requires (e.g., base64)
        };
    }));

    console.log('--- Files to be processed: ', resumesData.map(f => f.name));
    
    // CALL THE API TO SEND REQUEST
    const response = await axios.post<StartResponse>(
      `${apiURL}/ai/rar/v1/job_description_writer`,
      {job_openings: resumesData},
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          [apiHeaderName]: apiKey
        }
      }
    );

    console.log(`--- Job Initiation API Response Status: ${response.status} ---`);
    console.log(`--- Job Initiation API Response Data:`, response.data, '---');

    // Basic validation of the response structure
    if (!response.data || !response.data.trace_id) {
        throw new Error('API response did not include a trace_id.');
    }

    return response.data; // Return the parsed JSON response { trace_id: "...", message: "..." }
  } catch (error: any) {
    console.error('Error processing job descriptions:', error.response?.data || error.message);
    throw new Error(`Failed to initiate job description processing. Details: ${error.message}`);
  }
}


/**
 * Checks the status of a specific job using its trace ID.
 * @param {string} traceId - The unique identifier for the job.
 * @returns {Promise<JobStatus>} An object containing the current status, progress, and results (if completed).
 * @throws {Error} If the API call fails or the job is not found.
 */
export async function checkRARStatus(traceId: string): Promise<JobStatus> {
  if (!traceId) {
    throw new Error('Trace ID is required to check job status.');
  }
  try {
    const { apiURL, apiHeaderName, apiKey } = getRARAPIConfig();
    console.log(`Checking RAR STATUS for trace ID: ${traceId} at: ${apiURL}/ai/rar/v1/status/${traceId}`);

    const response = await axios.get<JobStatus>(
      `${apiURL}/ai/rar/v1/status/${traceId}`,
      {
        headers: {
          [apiHeaderName]: apiKey,
          'Accept': 'application/json',
        }
      }
    );

    console.log(`--- RAR Job Status API Response: ${response.status} ---`);

    // Validate the response structure based on JobStatus interface
     if (!response.data || typeof response.data.status !== 'string') {
        console.error("Invalid status response structure:", response.data);
        throw new Error('Received invalid status response from API.');
    }

    return response.data; // Return the parsed JSON response
  } catch (error: any) {
    console.error(`Error in 'checkRARStatus' checking job status for trace ID ${traceId}:`, error.response?.data || error.message);
    if (error.response?.status === 404) {
        throw new Error(`Job with trace ID ${traceId} not found.`);
    }
    throw new Error(`Failed to check job status for trace ID ${traceId}. Details: ${error.message}`);
  }
}
