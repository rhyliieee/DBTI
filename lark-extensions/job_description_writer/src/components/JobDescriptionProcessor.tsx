// import React, { useState, useCallback } from 'react';
// import { FileWithContent, JobDescription, JobResumeMatch } from '../types';
// import { 
//   startJDWriter, 
//   apiJDWHealthCheck, 
//   checkJDWStatus 
// } from '../utils/api';
// import { useLarkBase } from '../hooks/useLarkBase';
// import FileUploader from './FileUploader';
// import LoadingIndicator from './LoadingIndicator';
// import TabbedButton from './TabButton'

// // Define Tab names
// type TabName = 'selectOrCreateJob' | 'analyzeResumes' | 'viewResults';

// // CONSTANTS TO HANDLE POLLING
// const POLLING_INTERVAL_MS = 2000; // 2 seconds
// const MAX_POLLING_ATTEMPTS = 15; // Stop polling after 5 minutes (100 * 3s) to prevent infinite loops

// /**
//  * Component to handle uploading job requirement files, processing them via API,
//  * polling for status, and updating Lark Base upon completion.
//  */
// const JobDescriptionProcessor: React.FC = () => {
  
//   const [files, setFiles] = useState<FileWithContent[]>([]); // Files selected by the user
//   const [isProcessing, setIsProcessing] = useState(false); // Is a job currently running?
//   const [jobResults, setJobResults] = useState<JobDescription[]>([]); // Results from a completed job
//   const [isSuccess, setIsSuccess] = useState(false); // Did the last job complete successfully?
//   const [errorMessage, setErrorMessage] = useState<string | null>(null); // Error message to display
//   const [currentTraceId, setCurrentTraceId] = useState<string | null>(null); // Trace ID of the current/last job
//   const [jobProgress, setJobProgress] = useState<Record<string, string>>({}); // Progress details per file
//   const [pollingAttempts, setPollingAttempts] = useState(0); // Counter for polling attempts

//   const { loading: larkLoading, error: larkError, existingJobOpenings: existingJobs, updateRecords } = useLarkBase();

//   /**
//  * Handles files loaded from the FileUploader component.
//  * Resets state for a new job.
//  */
//   const handleFilesLoaded = useCallback((loadedFiles: FileWithContent[]) => {
//     console.log(`Files loaded: ${loadedFiles.length}`);
//     setFiles(loadedFiles);
//     // Reset state for a new operation
//     setIsSuccess(false);
//     setErrorMessage(null);
//     setJobResults([]);
//     setCurrentTraceId(null);
//     setJobProgress({});
//     setPollingAttempts(0);
//   }, []);

//   /**
//    * Polls the API for the status of the job associated with the given trace ID.
//    */
//   const pollJobStatus = useCallback(async (tid: string) => {
//     if (!tid) {
//         console.error("Polling attempted without a trace ID.");
//         setErrorMessage("Cannot check job status: Missing Trace ID.");
//         setIsProcessing(false); // Stop processing state
//         return;
//     }

//     console.log(`Polling status for trace ID: ${tid}, Attempt: ${pollingAttempts + 1}`);

//     // Check if max polling attempts exceeded
//     if (pollingAttempts >= MAX_POLLING_ATTEMPTS) {
//         console.warn(`Max polling attempts reached for trace ID: ${tid}`);
//         setErrorMessage(`Job status check timed out after ${MAX_POLLING_ATTEMPTS} attempts. Please check the API status or try again later.`);
//         setIsProcessing(false);
//         setCurrentTraceId(null); // Clear trace ID as the job is considered stalled
//         setPollingAttempts(0); // Reset attempts
//         return;
//     }

//     try {
//       const statusResponse = await checkJDWStatus(tid);
//       setJobProgress(statusResponse.progress || {}); // Update progress state

//       console.log(`Job Status: ${statusResponse.status}`);

//       switch (statusResponse.status) {
//         case 'completed':
//           console.log("Job completed successfully. Results:", statusResponse.results.descriptions);
//           setJobResults(statusResponse.results.job_descriptions); // Store results
//           setIsSuccess(true);
//           setIsProcessing(false);
//           setCurrentTraceId(null); 
//           setPollingAttempts(0); 

//           // console.log("Job results:", jobResults);

//           // --- Update Lark Base ---
//           if (statusResponse.results && statusResponse.results.job_descriptions.length > 0) {
//             try {
//               console.log("Attempting to update Lark Base...");
//               await updateRecords(statusResponse.results.job_descriptions, files);
//               console.log("Lark Base updated successfully.");
//               // Optionally add a specific success message for Lark update
//             } catch (larkUpdateError: any) {
//               console.error("Failed to update Lark Base:", larkUpdateError);
//               // Keep the overall success state, but show a specific error for Lark
//               setErrorMessage(`Job descriptions processed, but failed to update Lark Base: ${larkUpdateError.message}`);
//             }
//           } else {
//              console.log("Job completed, but no results to update in Lark Base.");
//              // Handle case with no results if needed
//           }
//           break;

//         case 'failed':
//           console.error(`Job failed. Trace ID: ${tid}. Error: ${statusResponse.error}`);
//           setErrorMessage(`Job processing failed: ${statusResponse.error || 'Unknown error'}. Trace ID: ${tid}`);
//           setIsProcessing(false);
//           setCurrentTraceId(null); // Clear trace ID
//           setPollingAttempts(0); // Reset attempts
//           break;

//         case 'running':
//         case 'pending':
//           // Job is still in progress, schedule the next poll
//           setPollingAttempts(prev => prev + 1); // Increment attempts
//           setTimeout(() => pollJobStatus(tid), POLLING_INTERVAL_MS);
//           break;

//         default:
//           // Unexpected status
//           console.warn(`Received unexpected job status: ${statusResponse.status}`);
//           // Continue polling for a few more times in case it's transient
//            setPollingAttempts(prev => prev + 1);
//            setTimeout(() => pollJobStatus(tid), POLLING_INTERVAL_MS);
//           break;
//       }
//     } catch (error: any) {
//       console.error(`Error during polling for trace ID ${tid}:`, error);
//       // Decide if polling should stop or continue based on the error
//       // For now, stop polling on error to prevent infinite loops on persistent issues
//       setErrorMessage(`Error checking job status: ${error.message}. Polling stopped.`);
//       setIsProcessing(false);
//       setCurrentTraceId(null); // Clear trace ID
//       setPollingAttempts(0); // Reset attempts
//     }
//   }, [pollingAttempts, updateRecords]); // Include dependencies

//   /**
//    * Initiates the file processing workflow:
//    * 1. Performs API health check.
//    * 2. Sends files to the processing endpoint.
//    * 3. Starts polling for job status.
//    */
//   const handleProcessFiles = async () => {

//     if (files.length === 0) {
//       setErrorMessage('Please upload at least one file before processing.');
//       return;
//     }

//     // Reset state before starting
//     setIsProcessing(true);
//     setErrorMessage(null);
//     setIsSuccess(false);
//     setJobResults([]);
//     setJobProgress({});
//     setCurrentTraceId(null);
//     setPollingAttempts(0); // Reset polling attempts for new job

//     try {
//       // 1. Perform API Health Check (Optional but recommended)
//       console.log("Performing API health check...");
//       const apiStatus = await apiJDWHealthCheck();
//       console.log("API health check successful.");

//       // 2. Call the API to start the job
//       console.log("Initiating job description processing...");
//       const startResponse = await startJDWriter(files);
//       console.log(`Job initiated successfully. Trace ID: ${startResponse.trace_id}`);
//       setCurrentTraceId(startResponse.trace_id);

//       // 3. Start Polling for Status
//       // Use setTimeout to ensure state update happens before first poll
//       setTimeout(() => pollJobStatus(startResponse.trace_id), POLLING_INTERVAL_MS / 2); // Start polling slightly faster first time

//     } catch (err: any) {
//       console.error('Error processing files:', err);
//       setErrorMessage(`Failed to process job descriptions: ${err.message}`);
//       setIsProcessing(false); // Ensure processing stops on initial error
//       setCurrentTraceId(null); // Clear any potentially set trace ID
//     }
//   };
  
//   if (larkLoading) {
//     return <LoadingIndicator message="Initializing Lark Base..." />;
//   }

//   // Display error if Lark Base initialization failed
//   if (larkError) {
//     return (
//       <div className="p-4 bg-red-100 text-red-700 rounded-lg border border-red-300 font-quicksand">
//         <p className="font-semibold">Lark Base Initialization Error:</p>
//         <p>{larkError}</p>
//         <p className="mt-2 text-sm">Please ensure the Lark Base connection is configured correctly and refresh the page.</p>
//       </div>
//     );
//   }

//   // MAIN COMPONENT UI RENDERING
//   return (
//     <div className="p-4 md:p-6 max-w-4xl mx-auto font-sans"> {/* Use a common sans-serif font */}
//       <h1 className="text-xl md:text-2xl font-bold mb-6 text-center text-gray-800">
//         Job Description Processor
//       </h1>

//       {/*Tabs*/}
//       {/* <div className='mb-6'>
//         <TabbedButton tab1='Job Openings' tab2='Candidates' tab3='Results'></TabbedButton>
//       </div> */}

//       {/* File Uploader Section */}
//       <div className="mb-6">
//         <FileUploader onFilesLoaded={handleFilesLoaded} />
//       </div>

//       {/* Process Button */}
//       <div className="flex justify-center mb-6">
//         <button
//           onClick={handleProcessFiles}
//           disabled={isProcessing || files.length === 0 || larkLoading} // Disable if processing, no files, or Lark loading
//           className={`px-6 py-3 rounded-lg text-white font-semibold transition-all duration-300 ease-in-out shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
//             isProcessing || files.length === 0 || larkLoading
//               ? 'bg-gray-400 cursor-not-allowed opacity-70'
//               : 'bg-green-600 hover:bg-green-700'
//           }`}
//         >
//           {isProcessing ? 'Processing...' : 'Process Job Descriptions'}
//         </button>
//       </div>

//       {/* Processing Indicator and Progress Display */}
//       {isProcessing && (
//         <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
//           <LoadingIndicator message="Processing job descriptions, please wait..." />
//           {Object.entries(jobProgress).length > 0 && (
//             <div className="mt-4">
//               <h3 className="font-semibold text-gray-700 text-lg mb-2 text-center">Job Progress:</h3>
//               <ul className="space-y-1 text-sm list-none pl-0 max-w-md mx-auto">
//                 {Object.entries(jobProgress).map(([filename, status]) => (
//                   <li key={filename} className="flex justify-between items-center py-1 px-2 rounded bg-white shadow-sm">
//                     <span className="text-gray-600 truncate pr-2">{filename}:</span>
//                     <span className={`
//                       px-2 py-0.5 rounded-full text-xs font-medium
//                       ${status === 'completed' ? 'bg-green-100 text-green-800' :
//                         status === 'failed' ? 'bg-red-100 text-red-800' :
//                         status === 'running' ? 'bg-blue-100 text-blue-800 animate-pulse' : // Added running state style
//                         'bg-yellow-100 text-yellow-800'}
//                     `}>
//                       {status}
//                     </span>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>
//       )}

//       {/* Error Message Display */}
//       {errorMessage && !isProcessing && ( // Show errors only when not processing
//         <div className="mt-6 p-4 bg-red-100 text-red-800 rounded-lg border border-red-300 font-quicksand shadow-md">
//           <p className="font-semibold">Error:</p>
//           <p>{errorMessage}</p>
//         </div>
//       )}

//       {/* Success Message and Results Summary */}
//       {isSuccess && !isProcessing && ( // Show success only when not processing
//         <div className="mt-6 p-4 bg-green-50 text-green-800 rounded-lg border border-green-200 font-quicksand shadow-md">
//           <p className="font-semibold">Success!</p>
//           <p>Successfully processed {jobResults.length} job description(s).</p>
//           {/* Optional: Add message about Lark Base update status based on potential errors */}
//           {errorMessage && errorMessage.includes("Lark Base") && (
//              <p className="mt-1 text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200">{errorMessage}</p>
//           )}
//           {jobResults.length > 0 && (
//             <>
//               <p className="mt-3 font-semibold">Summary:</p>
//               <ul className="mt-1 list-disc list-inside text-sm space-y-1">
//                 {jobResults.map((result, index) => (
//                   <li key={index}>
//                     <strong>{`Job Title: ${result.job_title || 'N/A'}`}</strong><br/>
//                     {`Job Location: ${result.job_location || 'N/A'}\n`}<br/>
//                     {`Job Description: ${result.finalized_job_description || 'N/A'}`}<br/>
//                     {/* Add more details if available in JobDescription type */}
//                   </li>
//                 ))}
//               </ul>
//             </>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// export default JobDescriptionProcessor;

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FileWithContent, JobDescription, ExistingJobOpening } from '../types';
import {
    startJDWriter, // Rename for clarity
    apiJDWHealthCheck,
    checkJDWStatus,
    startResumeAnalysis, // New API call
    apiRARHealthCheck,        // New health check
    checkRARStatus            // New status check
} from '../utils/api';
import { useLarkBase } from '../hooks/useLarkBase'; // Import new type/hook result
import FileUploader from './FileUploader';
import LoadingIndicator from './LoadingIndicator';
import TabButton from './TabbedButton'; // Assuming a simple TabButton component exists
import ExistingJobSelector from './ExistingJobSelector'; // New component for Tab 1
import ResumeUploader from './ResumeUploader'; // New component for Tab 2
// import AnalysisResultsTable from './AnalysisResultsTable'; // New component for Tab 3

// Define Tab names
type TabName = 'selectOrCreateJob' | 'analyzeResumes' | 'viewResults';

// Define structure for analysis results state
interface ResumeAnalysisResultItem {
    candidate_name: string;
    match_score: number;
    summary: string;
    // Add other fields from your API response as needed
}

// CONSTANTS TO HANDLE POLLING (Can be reused or have separate ones)
const POLLING_INTERVAL_MS = 3000; // 3 seconds (adjust as needed)
const MAX_POLLING_ATTEMPTS = 20; // Stop polling after 1 minute

/**
 * Main component managing the 3-tab workflow:
 * 1. Select/Create Job Descriptions
 * 2. Upload Resumes & Analyze
 * 3. View Analysis Results
 */
const JobDescriptionProcessor: React.FC = () => {
  // --- State Management ---
  const [activeTab, setActiveTab] = useState<TabName>('selectOrCreateJob');

  // Tab 1 State
  const [selectedExistingJobs, setSelectedExistingJobs] = useState<ExistingJobOpening[]>([]);
  const [uploadedJdFiles, setUploadedJdFiles] = useState<FileWithContent[]>([]);
  const [isProcessingJd, setIsProcessingJd] = useState(false);
  const [jdProcessingError, setJdProcessingError] = useState<string | null>(null);
  const [jdTraceId, setJdTraceId] = useState<string | null>(null);
  const [jdProgress, setJdProgress] = useState<Record<string, string>>({});
  const [jdPollingAttempts, setJdPollingAttempts] = useState(0);
  const [processedJobDescriptions, setProcessedJobDescriptions] = useState<JobDescription[]>([]); // Output of Tab 1

  // Tab 2 State
  const [selectedJobForAnalysis, setSelectedJobForAnalysis] = useState<JobDescription | null>(null);
  const [uploadedResumeFiles, setUploadedResumeFiles] = useState<FileWithContent[]>([]); // Use FileWithContent for resumes too
  const [isProcessingResumes, setIsProcessingResumes] = useState(false);
  const [resumeProcessingError, setResumeProcessingError] = useState<string | null>(null);
  const [resumeTraceId, setResumeTraceId] = useState<string | null>(null);
  const [resumeProgress, setResumeProgress] = useState<Record<string, string>>({}); // If API provides per-resume progress
  const [resumePollingAttempts, setResumePollingAttempts] = useState(0);

  // Tab 3 State
  const [analysisResults, setAnalysisResults] = useState<ResumeAnalysisResultItem[]>([]); // Output of Tab 2/API
  const [larkUpdateError, setLarkUpdateError] = useState<string | null>(null); // Specific error for Lark update failures

  // Lark Base Hook
  const {
      loading: larkLoading,
      error: larkError,
      updateRecords: updateLarkRecords, // Renamed for clarity
      existingJobOpenings,
      // getRecordDetails // Use this if needed to fetch full details later
  } = useLarkBase();

  // --- Derived State ---
  // Combine selected existing jobs (need full data) and newly processed jobs for Tab 2 dropdown
  const availableJobsForAnalysis = useMemo(() => {
      // TODO: If existing jobs need full details, fetch them here using getRecordDetails
      // For now, assuming processedJobDescriptions is the primary source after Tab 1 processing
      return processedJobDescriptions;
  }, [processedJobDescriptions]);

  // --- Callbacks for Tab 1 ---
  const handleExistingJobsSelected = useCallback((selected: ExistingJobOpening[]) => {
      setSelectedExistingJobs(selected);
      // Clear uploaded files if user switches to selecting existing ones
      setUploadedJdFiles([]);
      setProcessedJobDescriptions([]); // Reset processed JDs
      setJdProcessingError(null);
  }, []);

  const handleJdFilesLoaded = useCallback((loadedFiles: FileWithContent[]) => {
      setUploadedJdFiles(loadedFiles);
      // Clear selected existing jobs if user switches to uploading
      setSelectedExistingJobs([]);
      setProcessedJobDescriptions([]); // Reset processed JDs
      setJdProcessingError(null);
  }, []);

   // --- Polling Logic for Job Description Writing (Adapted from original) ---
   const pollJdStatus = useCallback(async (tid: string) => {
    if (!tid) return; // Should not happen if called correctly

    console.log(`Polling JD status for trace ID: ${tid}, Attempt: ${jdPollingAttempts + 1}`);

    if (jdPollingAttempts >= MAX_POLLING_ATTEMPTS) {
        console.warn(`Max polling attempts reached for JD trace ID: ${tid}`);
        setJdProcessingError(`JD status check timed out. Trace ID: ${tid}`);
        setIsProcessingJd(false);
        setJdTraceId(null);
        setJdPollingAttempts(0);
        return;
    }

    try {
      const statusResponse = await checkJDWStatus(tid);
      setJdProgress(statusResponse.progress || {});

      switch (statusResponse.status) {
        case 'completed':
          console.log("JD processing completed. Results:", statusResponse.results);
          const results = statusResponse.results?.job_descriptions || [];
          setProcessedJobDescriptions(results); // Store results for Tab 2
          setIsProcessingJd(false);
          setJdTraceId(null);
          setJdPollingAttempts(0);
          setJdProcessingError(null); // Clear previous errors

          // --- Update Lark Base ---
          if (results.length > 0) {
            try {
              console.log("Attempting to update Lark Base with new JDs...");
              await updateLarkRecords(results);
              console.log("Lark Base updated successfully with new JDs.");
              setLarkUpdateError(null);
            } catch (larkErr: any) {
              console.error("Failed to update Lark Base with new JDs:", larkErr);
              setLarkUpdateError(`New JDs processed, but failed to update Lark Base: ${larkErr.message}`);
              // Keep processed JDs available despite Lark error
            }
          } else {
             console.log("JD processing completed, but no results to update in Lark Base.");
          }
          // Optionally move to Tab 2 automatically or indicate completion
          // setActiveTab('analyzeResumes');
          break;

        case 'failed':
          console.error(`JD processing failed. Trace ID: ${tid}. Error: ${statusResponse.error}`);
          setJdProcessingError(`JD processing failed: ${statusResponse.error || 'Unknown error'}. Trace ID: ${tid}`);
          setIsProcessingJd(false);
          setJdTraceId(null);
          setJdPollingAttempts(0);
          break;

        case 'running':
        case 'pending':
          setJdPollingAttempts(prev => prev + 1);
          setTimeout(() => pollJdStatus(tid), POLLING_INTERVAL_MS);
          break;

        default:
          console.warn(`Received unexpected JD status: ${statusResponse.status}`);
          setJdPollingAttempts(prev => prev + 1);
          setTimeout(() => pollJdStatus(tid), POLLING_INTERVAL_MS);
          break;
      }
    } catch (error: any) {
      console.error(`Error polling JD status for trace ID ${tid}:`, error);
      setJdProcessingError(`Error checking JD status: ${error.message}. Polling stopped.`);
      setIsProcessingJd(false);
      setJdTraceId(null);
      setJdPollingAttempts(0);
    }
  }, [jdPollingAttempts, updateLarkRecords]);


  const handleProcessNewJds = async () => {
    if (uploadedJdFiles.length === 0) {
      setJdProcessingError('Please upload at least one .txt file.');
      return;
    }

    setIsProcessingJd(true);
    setJdProcessingError(null);
    setLarkUpdateError(null);
    setProcessedJobDescriptions([]);
    setJdProgress({});
    setJdTraceId(null);
    setJdPollingAttempts(0);

    try {
      // Optional: Health check before starting
      // await jdwApiHealthCheck();

      console.log("Initiating new job description processing...");
      const startResponse = await startJDWriter(uploadedJdFiles);
      console.log(`JD processing initiated. Trace ID: ${startResponse.trace_id}`);
      setJdTraceId(startResponse.trace_id);

      // Start Polling
      setTimeout(() => pollJdStatus(startResponse.trace_id), POLLING_INTERVAL_MS / 2);

    } catch (err: any) {
      console.error('Error starting JD processing:', err);
      setJdProcessingError(`Failed to start JD processing: ${err.message}`);
      setIsProcessingJd(false);
      setJdTraceId(null);
    }
  };

  // --- Callbacks for Tab 2 ---
   const handleJobSelectedForAnalysis = useCallback((jobTitle: string) => {
        const selected = availableJobsForAnalysis.find(job => job.job_title === jobTitle);
        setSelectedJobForAnalysis(selected || null);
        setResumeProcessingError(null); // Clear errors when selection changes
        setAnalysisResults([]); // Clear previous results
    }, [availableJobsForAnalysis]);

  const handleResumeFilesLoaded = useCallback((loadedFiles: FileWithContent[]) => {
      // Filter for PDF files explicitly if needed, though ResumeUploader should handle this
      const pdfFiles = loadedFiles.filter(f => f.file.type === 'application/pdf' || f.file.name.toLowerCase().endsWith('.pdf'));
       if (pdfFiles.length !== loadedFiles.length) {
           setResumeProcessingError("Please upload only PDF files for resumes.");
           // Optionally clear the uploader state or just keep the valid PDFs
           setUploadedResumeFiles(pdfFiles);
       } else {
            setUploadedResumeFiles(pdfFiles);
            setResumeProcessingError(null); // Clear error if files are valid
       }
  }, []);

   // --- Polling Logic for Resume Analysis ---
   const pollResumeStatus = useCallback(async (tid: string) => {
    if (!tid) return;

    console.log(`Polling Resume Analysis status for trace ID: ${tid}, Attempt: ${resumePollingAttempts + 1}`);

    if (resumePollingAttempts >= MAX_POLLING_ATTEMPTS) {
        console.warn(`Max polling attempts reached for Resume Analysis trace ID: ${tid}`);
        setResumeProcessingError(`Resume Analysis status check timed out. Trace ID: ${tid}`);
        setIsProcessingResumes(false);
        setResumeTraceId(null);
        setResumePollingAttempts(0);
        return;
    }

    try {
      // Use the new status check function
      const statusResponse = await checkRARStatus(tid);
      setResumeProgress(statusResponse.progress || {}); // Assuming progress exists

      switch (statusResponse.status) {
        case 'completed':
          console.log("Resume Analysis completed. Results:", statusResponse.results);
          // Adjust based on the actual structure of 'results' from the RAR API
          const results = statusResponse.results?.analysis_results || [];
          setAnalysisResults(results); // Store analysis results for Tab 3
          setIsProcessingResumes(false);
          setResumeTraceId(null);
          setResumePollingAttempts(0);
          setResumeProcessingError(null);

          // --- Move to Results Tab ---
          setActiveTab('viewResults');
          break;

        case 'failed':
          console.error(`Resume Analysis failed. Trace ID: ${tid}. Error: ${statusResponse.error}`);
          setResumeProcessingError(`Resume Analysis failed: ${statusResponse.error || 'Unknown error'}. Trace ID: ${tid}`);
          setIsProcessingResumes(false);
          setResumeTraceId(null);
          setResumePollingAttempts(0);
          break;

        case 'running':
        case 'pending':
          setResumePollingAttempts(prev => prev + 1);
          setTimeout(() => pollResumeStatus(tid), POLLING_INTERVAL_MS);
          break;

        default:
          console.warn(`Received unexpected Resume Analysis status: ${statusResponse.status}`);
          setResumePollingAttempts(prev => prev + 1);
          setTimeout(() => pollResumeStatus(tid), POLLING_INTERVAL_MS);
          break;
      }
    } catch (error: any) {
      console.error(`Error polling Resume Analysis status for trace ID ${tid}:`, error);
      setResumeProcessingError(`Error checking Resume Analysis status: ${error.message}. Polling stopped.`);
      setIsProcessingResumes(false);
      setResumeTraceId(null);
      setResumePollingAttempts(0);
    }
  }, [resumePollingAttempts]); // Add dependencies if needed

  const handleAnalyzeResumes = async () => {
    if (!selectedJobForAnalysis) {
      setResumeProcessingError('Please select a job opening first.');
      return;
    }
    if (uploadedResumeFiles.length === 0) {
      setResumeProcessingError('Please upload at least one resume PDF file.');
      return;
    }

    setIsProcessingResumes(true);
    setResumeProcessingError(null);
    setAnalysisResults([]); // Clear previous results
    setResumeProgress({});
    setResumeTraceId(null);
    setResumePollingAttempts(0);

    try {
      // Optional: Health check
      // await apiRARHealthCheck();

      console.log(`Initiating resume analysis for job: ${selectedJobForAnalysis.job_title}`);
      // Use the new API call function
      const startResponse = await startResumeAnalysis(selectedJobForAnalysis, uploadedResumeFiles);
      console.log(`Resume analysis initiated. Trace ID: ${startResponse.trace_id}`);
      setResumeTraceId(startResponse.trace_id);

      // Start Polling
      setTimeout(() => pollResumeStatus(startResponse.trace_id), POLLING_INTERVAL_MS / 2);

    } catch (err: any) {
      console.error('Error starting resume analysis:', err);
      setResumeProcessingError(`Failed to start resume analysis: ${err.message}`);
      setIsProcessingResumes(false);
      setResumeTraceId(null);
    }
  };


  // --- Render Logic ---

  // Loading/Error state for Lark Base initialization
  if (larkLoading) {
    return <LoadingIndicator message="Initializing Lark Base connection..." />;
  }
  if (larkError) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded-lg border border-red-300 font-quicksand">
        <p className="font-panton-bold">Lark Base Initialization Error:</p> {/* Apply Font */}
        <p>{larkError}</p>
        <p className="mt-2 text-sm">Please ensure the Lark Base connection is configured correctly and refresh the page.</p>
      </div>
    );
  }

  return (
    // Apply background and base text color
    <div className="p-4 md:p-6 max-w-6xl mx-auto font-quicksand bg-[#F9F9F9] text-[#111613]">
      {/* Use Panton Bold for main heading */}
      <h1 className="text-2xl md:text-3xl font-panton-bold mb-6 text-center">
        Job & Resume Processor
      </h1>

      {/* Tab Navigation */}
      <div className="flex justify-center border-b border-gray-300 mb-6">
         {/* Apply Accent Color for active tab */}
        <TabButton
          label="1. Select/Create Job"
          isActive={activeTab === 'selectOrCreateJob'}
          onClick={() => setActiveTab('selectOrCreateJob')}
          disabled={isProcessingJd || isProcessingResumes} // Disable tabs during processing
        />
        <TabButton
          label="2. Analyze Resumes"
          isActive={activeTab === 'analyzeResumes'}
          onClick={() => setActiveTab('analyzeResumes')}
          // Disable if no jobs are ready or during processing
          disabled={availableJobsForAnalysis.length === 0 || isProcessingJd || isProcessingResumes}
        />
        <TabButton
          label="3. View Results"
          isActive={activeTab === 'viewResults'}
          onClick={() => setActiveTab('viewResults')}
           // Disable if no results are ready or during processing
          disabled={analysisResults.length === 0 || isProcessingJd || isProcessingResumes}
        />
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {/* --- Tab 1 Content --- */}
        {activeTab === 'selectOrCreateJob' && (
          <div>
            <h2 className="text-xl font-panton-bold mb-4">Select Existing or Upload New Job Opening</h2>

             {/* Option 1: Select Existing */}
             <ExistingJobSelector
                jobOpenings={existingJobOpenings}
                onSelectionChange={handleExistingJobsSelected}
                disabled={isProcessingJd}
             />

             {/* Separator */}
             <div className="my-6 text-center text-gray-500 font-semibold">OR</div>

             {/* Option 2: Upload New */}
             <div className="mb-4 p-4 border rounded-md bg-white shadow-sm">
                 <h3 className="font-panton-bold mb-3 text-lg">Upload New Job Requirements (.txt files)</h3>
                <FileUploader onFilesLoaded={handleJdFilesLoaded} accept=".txt" />
                <div className="flex justify-center mt-4">
                    <button
                      onClick={handleProcessNewJds}
                      disabled={isProcessingJd || uploadedJdFiles.length === 0}
                      // Apply Accent Color for button
                      className={`px-5 py-2 rounded text-white font-semibold transition-colors duration-200 ${
                        isProcessingJd || uploadedJdFiles.length === 0
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-[#37A533] hover:bg-[#1E651C]' // Accent colors
                      }`}
                    >
                      {isProcessingJd ? 'Processing JDs...' : 'Process Uploaded Files'}
                    </button>
                </div>
             </div>

             {/* JD Processing Indicator/Progress */}
             {isProcessingJd && (
                <div className="mt-4 p-3 border rounded bg-blue-50">
                    <LoadingIndicator message="Processing job descriptions..." />
                    {/* TODO: Display jdProgress if needed */}
                </div>
             )}

             {/* JD Error Display */}
             {jdProcessingError && (
                <div className="mt-4 p-3 bg-red-100 text-red-700 rounded border border-red-300">
                    Error: {jdProcessingError}
                </div>
             )}
             {/* Lark Update Error Display */}
             {larkUpdateError && (
                 <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded border border-yellow-300">
                     Warning: {larkUpdateError}
                 </div>
             )}

             {/* Display Processed JDs (Optional Confirmation) */}
             {processedJobDescriptions.length > 0 && !isProcessingJd && (
                 <div className="mt-4 p-3 bg-green-50 text-green-800 rounded border border-green-200">
                     <p className="font-semibold">Job Description(s) Processed:</p>
                     <ul className="list-disc list-inside text-sm mt-1">
                         {processedJobDescriptions.map((jd, i) => <li key={i}>{jd.job_title}</li>)}
                     </ul>
                     <p className="mt-2">You can now proceed to the 'Analyze Resumes' tab.</p>
                 </div>
             )}
          </div>
        )}

        {/* --- Tab 2 Content --- */}
        {activeTab === 'analyzeResumes' && (
          <div>
            <h2 className="text-xl font-panton-bold mb-4">Upload Resumes for Analysis</h2>

            {/* Job Selection Dropdown */}
            <div className="mb-4">
              <label htmlFor="jobSelect" className="block text-sm font-medium mb-1">Select Job Opening:</label>
              <select
                id="jobSelect"
                value={selectedJobForAnalysis?.job_title || ''}
                onChange={(e) => handleJobSelectedForAnalysis(e.target.value)}
                disabled={isProcessingResumes || availableJobsForAnalysis.length === 0}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#37A533] focus:border-[#37A533]" // Accent focus color
              >
                <option value="" disabled>-- Select a Job --</option>
                {availableJobsForAnalysis.map((job) => (
                  <option key={job.job_title} value={job.job_title}>
                    {job.job_title}
                  </option>
                ))}
              </select>
            </div>

            {/* Resume Uploader */}
            {selectedJobForAnalysis && (
                 <div className="mb-4 p-4 border rounded-md bg-white shadow-sm">
                     <h3 className="font-panton-bold mb-3 text-lg">Upload Candidate Resumes (.pdf files)</h3>
                    <ResumeUploader onFilesLoaded={handleResumeFilesLoaded} disabled={isProcessingResumes} />
                 </div>
            )}

            {/* Analyze Button */}
            <div className="flex justify-center mt-4">
              <button
                onClick={handleAnalyzeResumes}
                disabled={!selectedJobForAnalysis || uploadedResumeFiles.length === 0 || isProcessingResumes}
                 className={`px-5 py-2 rounded text-white font-semibold transition-colors duration-200 ${
                    !selectedJobForAnalysis || uploadedResumeFiles.length === 0 || isProcessingResumes
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-[#37A533] hover:bg-[#1E651C]' // Accent colors
                  }`}
              >
                {isProcessingResumes ? 'Analyzing Resumes...' : 'Upload and Analyze'}
              </button>
            </div>

             {/* Resume Processing Indicator */}
             {isProcessingResumes && (
                <div className="mt-4 p-3 border rounded bg-blue-50">
                    <LoadingIndicator message="Analyzing resumes..." />
                     {/* TODO: Display resumeProgress if available */}
                </div>
             )}

             {/* Resume Error Display */}
             {resumeProcessingError && (
                <div className="mt-4 p-3 bg-red-100 text-red-700 rounded border border-red-300">
                    Error: {resumeProcessingError}
                </div>
             )}
          </div>
        )}

        {/* --- Tab 3 Content --- */}
        {activeTab === 'viewResults' && (
          <div>
            <h2 className="text-xl font-panton-bold mb-4">Resume Analysis Results</h2>
            {/* {analysisResults.length > 0 ? (
              <AnalysisResultsTable results={analysisResults} />
            ) : (
              <p className="text-center text-gray-500">No analysis results to display. Process resumes in Tab 2.</p>
            )} */}
             {/* Display Resume Processing Error if user navigates here while error exists */}
             {/* {resumeProcessingError && (
                <div className="mt-4 p-3 bg-red-100 text-red-700 rounded border border-red-300">
                    Error during analysis: {resumeProcessingError}
                </div>
             )} */}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDescriptionProcessor;

// --- Placeholder Components (Create these in separate files) ---

// Example TabButton.tsx
// const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; disabled?: boolean }> = ({ label, isActive, onClick, disabled }) => (
//   <button
//     onClick={onClick}
//     disabled={disabled}
//     className={`px-4 py-2 mx-1 font-semibold border-b-2 transition-colors duration-200 ${
//       isActive ? 'border-[#37A533] text-[#1E651C]' : 'border-transparent text-gray-500 hover:text-gray-700' // Accent active color
//     } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
//   >
//     {label}
//   </button>
// );

// Example ExistingJobSelector.tsx - Needs implementation
// Should display checkboxes for jobOpenings and call onSelectionChange

// Example ResumeUploader.tsx - Needs implementation
// Similar to FileUploader but likely specific to PDFs and potentially multiple files

// Example AnalysisResultsTable.tsx - Needs implementation
// Should take 'results' prop and display in a styled table