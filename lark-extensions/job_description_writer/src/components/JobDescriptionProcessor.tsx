import React, { useState, useCallback } from 'react';
import Markdown from 'react-markdown';
import { FileWithContent, JobDescription } from '../types';
import { processJobDescriptions, apiHealthCheck, checkJobStatus } from '../utils/api';
import { useLarkBase } from '../hooks/useLarkBase';
import FileUploader from './FileUploader';
import LoadingIndicator from './LoadingIndicator';

// CONSTANTS TO HANDLE POLLING
const POLLING_INTERVAL_MS = 2000; // 2 seconds
const MAX_POLLING_ATTEMPTS = 15; // Stop polling after 5 minutes (100 * 3s) to prevent infinite loops

/**
 * Component to handle uploading job requirement files, processing them via API,
 * polling for status, and updating Lark Base upon completion.
 */
const JobDescriptionProcessor: React.FC = () => {
  // const [files, setFiles] = useState<FileWithContent[]>([]);
  // const [processing, setProcessing] = useState(false);
  // const [results, setResults] = useState<JobDescription[]>([]);
  // const [success, setSuccess] = useState(false);
  // const [error, setError] = useState<string | null>(null);
  // const [traceID, setTraceId] = useState<string | null>(null);
  // const [jobProgress, setJobProgress] = useState<Record<string, string>>({});
  
  const [files, setFiles] = useState<FileWithContent[]>([]); // Files selected by the user
  const [isProcessing, setIsProcessing] = useState(false); // Is a job currently running?
  const [jobResults, setJobResults] = useState<JobDescription[]>([]); // Results from a completed job
  const [isSuccess, setIsSuccess] = useState(false); // Did the last job complete successfully?
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // Error message to display
  const [currentTraceId, setCurrentTraceId] = useState<string | null>(null); // Trace ID of the current/last job
  const [jobProgress, setJobProgress] = useState<Record<string, string>>({}); // Progress details per file
  const [pollingAttempts, setPollingAttempts] = useState(0); // Counter for polling attempts

  const { loading: larkLoading, error: larkError, updateRecords } = useLarkBase();

  /**
 * Handles files loaded from the FileUploader component.
 * Resets state for a new job.
 */
  const handleFilesLoaded = useCallback((loadedFiles: FileWithContent[]) => {
    console.log(`Files loaded: ${loadedFiles.length}`);
    setFiles(loadedFiles);
    // Reset state for a new operation
    setIsSuccess(false);
    setErrorMessage(null);
    setJobResults([]);
    setCurrentTraceId(null);
    setJobProgress({});
    setPollingAttempts(0);
  }, []);

  /**
   * Polls the API for the status of the job associated with the given trace ID.
   */
  const pollJobStatus = useCallback(async (tid: string) => {
    if (!tid) {
        console.error("Polling attempted without a trace ID.");
        setErrorMessage("Cannot check job status: Missing Trace ID.");
        setIsProcessing(false); // Stop processing state
        return;
    }

    console.log(`Polling status for trace ID: ${tid}, Attempt: ${pollingAttempts + 1}`);

    // Check if max polling attempts exceeded
    if (pollingAttempts >= MAX_POLLING_ATTEMPTS) {
        console.warn(`Max polling attempts reached for trace ID: ${tid}`);
        setErrorMessage(`Job status check timed out after ${MAX_POLLING_ATTEMPTS} attempts. Please check the API status or try again later.`);
        setIsProcessing(false);
        setCurrentTraceId(null); // Clear trace ID as the job is considered stalled
        setPollingAttempts(0); // Reset attempts
        return;
    }

    try {
      const statusResponse = await checkJobStatus(tid);
      setJobProgress(statusResponse.progress || {}); // Update progress state

      console.log(`Job Status: ${statusResponse.status}`);

      switch (statusResponse.status) {
        case 'completed':
          console.log("Job completed successfully. Results:", statusResponse.results.descriptions);
          setJobResults(statusResponse.results.job_descriptions); // Store results
          setIsSuccess(true);
          setIsProcessing(false);
          setCurrentTraceId(null); 
          setPollingAttempts(0); 

          // console.log("Job results:", jobResults);

          // --- Update Lark Base ---
          if (statusResponse.results && statusResponse.results.job_descriptions.length > 0) {
            try {
              console.log("Attempting to update Lark Base...");
              await updateRecords(statusResponse.results.job_descriptions);
              console.log("Lark Base updated successfully.");
              // Optionally add a specific success message for Lark update
            } catch (larkUpdateError: any) {
              console.error("Failed to update Lark Base:", larkUpdateError);
              // Keep the overall success state, but show a specific error for Lark
              setErrorMessage(`Job descriptions processed, but failed to update Lark Base: ${larkUpdateError.message}`);
            }
          } else {
             console.log("Job completed, but no results to update in Lark Base.");
             // Handle case with no results if needed
          }
          break;

        case 'failed':
          console.error(`Job failed. Trace ID: ${tid}. Error: ${statusResponse.error}`);
          setErrorMessage(`Job processing failed: ${statusResponse.error || 'Unknown error'}. Trace ID: ${tid}`);
          setIsProcessing(false);
          setCurrentTraceId(null); // Clear trace ID
          setPollingAttempts(0); // Reset attempts
          break;

        case 'running':
        case 'pending':
          // Job is still in progress, schedule the next poll
          setPollingAttempts(prev => prev + 1); // Increment attempts
          setTimeout(() => pollJobStatus(tid), POLLING_INTERVAL_MS);
          break;

        default:
          // Unexpected status
          console.warn(`Received unexpected job status: ${statusResponse.status}`);
          // Continue polling for a few more times in case it's transient
           setPollingAttempts(prev => prev + 1);
           setTimeout(() => pollJobStatus(tid), POLLING_INTERVAL_MS);
          break;
      }
    } catch (error: any) {
      console.error(`Error during polling for trace ID ${tid}:`, error);
      // Decide if polling should stop or continue based on the error
      // For now, stop polling on error to prevent infinite loops on persistent issues
      setErrorMessage(`Error checking job status: ${error.message}. Polling stopped.`);
      setIsProcessing(false);
      setCurrentTraceId(null); // Clear trace ID
      setPollingAttempts(0); // Reset attempts
    }
  }, [pollingAttempts, updateRecords]); // Include dependencies
  
  // const handleProcessFiles = async () => {
  //   if (files.length === 0) {
  //     setErrorMessage('Please upload at least one file before processing');
  //     return;
  //   }
    
  //   try {
  //     setIsProcessing(true);
  //     setErrorMessage(null);

  //     // PERFORM AN API HEALTH CHECK
  //     const healthStatus = await apiHealthCheck();
  //     if (!healthStatus) {
  //       setIsProcessing(false);
  //       setErrorMessage('There is a Problem in the API. Check the API Configuration and try again.');
  //     }
      
  //     // Call the API TO START THE JOB
  //     const response = await processJobDescriptions(files);
  //     setCurrentTraceId(response.trace_id);
      
  //     // Update the results state with the processed job descriptions
  //     // setResults(response);
      
  //     // Update the records in Lark Base
  //     // await updateRecords(response);
      
  //     // setSuccess(true);
  //     // setProcessing(false);

  //     // START POLLING FOR STATUS
  //     await pollJobStatus(response.trace_id);
  //   } catch (err) {
  //     console.error('Error processing files:', err);
  //     setError('Failed to process job descriptions. Please try again.');
  //     setProcessing(false);
  //   }
  // };

  /**
   * Initiates the file processing workflow:
   * 1. Performs API health check.
   * 2. Sends files to the processing endpoint.
   * 3. Starts polling for job status.
   */
  const handleProcessFiles = async () => {
    if (files.length === 0) {
      setErrorMessage('Please upload at least one file before processing.');
      return;
    }

    // Reset state before starting
    setIsProcessing(true);
    setErrorMessage(null);
    setIsSuccess(false);
    setJobResults([]);
    setJobProgress({});
    setCurrentTraceId(null);
    setPollingAttempts(0); // Reset polling attempts for new job

    try {
      // 1. Perform API Health Check (Optional but recommended)
      console.log("Performing API health check...");
      const apiStatus = await apiHealthCheck();
      console.log("API health check successful.");

      // 2. Call the API to start the job
      console.log("Initiating job description processing...");
      const startResponse = await processJobDescriptions(files);
      console.log(`Job initiated successfully. Trace ID: ${startResponse.trace_id}`);
      setCurrentTraceId(startResponse.trace_id);

      // 3. Start Polling for Status
      // Use setTimeout to ensure state update happens before first poll
      setTimeout(() => pollJobStatus(startResponse.trace_id), POLLING_INTERVAL_MS / 2); // Start polling slightly faster first time

    } catch (err: any) {
      console.error('Error processing files:', err);
      setErrorMessage(`Failed to process job descriptions: ${err.message}`);
      setIsProcessing(false); // Ensure processing stops on initial error
      setCurrentTraceId(null); // Clear any potentially set trace ID
    }
  };
  
  if (larkLoading) {
    return <LoadingIndicator message="Initializing Lark Base..." />;
  }
  
  // if (larkError) {
  //   return (
  //     <div className="p-4 bg-red-50 text-red-700 rounded-lg font-quicksand">
  //       <p>Error: {larkError}</p>
  //     </div>
  //   );
  // }

  // Display error if Lark Base initialization failed
  if (larkError) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-lg border border-red-300 font-quicksand">
        <p className="font-semibold">Lark Base Initialization Error:</p>
        <p>{larkError}</p>
        <p className="mt-2 text-sm">Please ensure the Lark Base connection is configured correctly and refresh the page.</p>
      </div>
    );
  }

  // MAIN COMPONENT UI RENDERING
  // return (
  //   <div className="p-6 max-w-4xl mx-auto">
  //     <h1 className="text-2xl font-bold mb-6 text-center font-panton text-gray-800">
  //       Job Description Processor
  //     </h1>
      
  //     <FileUploader onFilesLoaded={handleFilesLoaded} />
      
  //     <div className="flex justify-center">
  //       <button
  //         onClick={handleProcessFiles}
  //         disabled={processing || files.length === 0}
  //         className={`px-6 py-3 rounded-lg text-white font-panton transition-colors ${
  //           processing || files.length === 0
  //             ? 'bg-gray-400 cursor-not-allowed'
  //             : 'bg-green-600 hover:bg-green-700'
  //         }`}
  //       >
  //         {processing ? 'Processing...' : 'Process Job Descriptions'}
  //       </button>
  //     </div>
      
  //     {processing && (
  //       <div className="mt-6">
  //         <LoadingIndicator message="Processing job descriptions..." />
  //         {Object.entries(jobProgress).length > 0 && (
  //           <div className="mt-4">
  //             <h3 className="font-panton text-lg mb-2">Progress:</h3>
  //             <ul className="space-y-2">
  //               {Object.entries(jobProgress).map(([filename, status]) => (
  //                 <li key={filename} className="flex items-center">
  //                   <span className="mr-2">{filename}:</span>
  //                   <span className={`
  //                     px-2 py-1 rounded-full text-sm
  //                     ${status === 'completed' ? 'bg-green-100 text-green-800' : 
  //                       status === 'failed' ? 'bg-red-100 text-red-800' : 
  //                       'bg-yellow-100 text-yellow-800'}
  //                   `}>
  //                     {status}
  //                   </span>
  //                 </li>
  //               ))}
  //             </ul>
  //           </div>
  //         )}
  //       </div>
  //     )}
      
  //     {error && (
  //       <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg font-quicksand">
  //         <p>{error}</p>
  //       </div>
  //     )}
      
  //     {success && (
  //       <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-lg font-quicksand">
  //         <p>Successfully processed {results.length} job descriptions and updated Lark Base!</p>
  //         <p className="mt-2">
  //           <strong>Summary:</strong>
  //         </p>
  //         <ul className="mt-1 list-disc list-inside">
  //           {results.map((result, index) => (
  //             <li key={index}>
  //               {result.jobPosition} - Expires: {result.jobExpiryDate}
  //             </li>
  //           ))}
  //         </ul>
  //       </div>
  //     )}
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto font-sans"> {/* Use a common sans-serif font */}
      <h1 className="text-xl md:text-2xl font-bold mb-6 text-center text-gray-800">
        Job Description Processor
      </h1>

      {/* File Uploader Section */}
      <div className="mb-6">
        <FileUploader onFilesLoaded={handleFilesLoaded} />
      </div>

      {/* Process Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={handleProcessFiles}
          disabled={isProcessing || files.length === 0 || larkLoading} // Disable if processing, no files, or Lark loading
          className={`px-6 py-3 rounded-lg text-white font-semibold transition-all duration-300 ease-in-out shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
            isProcessing || files.length === 0 || larkLoading
              ? 'bg-gray-400 cursor-not-allowed opacity-70'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Process Job Descriptions'}
        </button>
      </div>

      {/* Processing Indicator and Progress Display */}
      {isProcessing && (
        <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <LoadingIndicator message="Processing job descriptions, please wait..." />
          {Object.entries(jobProgress).length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-700 text-lg mb-2 text-center">Job Progress:</h3>
              <ul className="space-y-1 text-sm list-none pl-0 max-w-md mx-auto">
                {Object.entries(jobProgress).map(([filename, status]) => (
                  <li key={filename} className="flex justify-between items-center py-1 px-2 rounded bg-white shadow-sm">
                    <span className="text-gray-600 truncate pr-2">{filename}:</span>
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs font-medium
                      ${status === 'completed' ? 'bg-green-100 text-green-800' :
                        status === 'failed' ? 'bg-red-100 text-red-800' :
                        status === 'running' ? 'bg-blue-100 text-blue-800 animate-pulse' : // Added running state style
                        'bg-yellow-100 text-yellow-800'}
                    `}>
                      {status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error Message Display */}
      {errorMessage && !isProcessing && ( // Show errors only when not processing
        <div className="mt-6 p-4 bg-red-100 text-red-800 rounded-lg border border-red-300 font-quicksand shadow-md">
          <p className="font-semibold">Error:</p>
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Success Message and Results Summary */}
      {isSuccess && !isProcessing && ( // Show success only when not processing
        <div className="mt-6 p-4 bg-green-50 text-green-800 rounded-lg border border-green-200 font-quicksand shadow-md">
          <p className="font-semibold">Success!</p>
          <p>Successfully processed {jobResults.length} job description(s).</p>
          {/* Optional: Add message about Lark Base update status based on potential errors */}
          {errorMessage && errorMessage.includes("Lark Base") && (
             <p className="mt-1 text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200">{errorMessage}</p>
          )}
          {jobResults.length > 0 && (
            <>
              <p className="mt-3 font-semibold">Summary:</p>
              <ul className="mt-1 list-disc list-inside text-sm space-y-1">
                {jobResults.map((result, index) => (
                  <li key={index}>
                    <strong>{`Job Title: ${result.job_title || 'N/A'}`}</strong><br/>
                    {`Job Location: ${result.job_location || 'N/A'}\n`}<br/>
                    {`Job Description: ${result.finalized_job_description || 'N/A'}`}<br/>
                    {/* Add more details if available in JobDescription type */}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default JobDescriptionProcessor;