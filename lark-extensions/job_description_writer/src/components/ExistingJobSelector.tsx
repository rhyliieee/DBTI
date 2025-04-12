import React, {useState, useCallback, ChangeEvent} from 'react';
import { ExistingJobOpening } from '../types'

interface ExistingJobSelectorProps {
    jobOpenings: ExistingJobOpening[]; // Array of jobs from Lark Base
    onSelectionChange: (selectedJobs: ExistingJobOpening[]) => void; // Callback with selected full objects
    disabled?: boolean;
  }
  
  const ExistingJobSelector: React.FC<ExistingJobSelectorProps> = ({
    jobOpenings,
    onSelectionChange,
    disabled,
  }) => {
    // Internal state to track selected job IDs
    const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  
    const handleCheckboxChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
      const { value: jobId, checked } = event.target;
      const newSelectedJobIds = new Set(selectedJobIds);
  
      if (checked) {
        newSelectedJobIds.add(jobId);
      } else {
        newSelectedJobIds.delete(jobId);
      }
  
      setSelectedJobIds(newSelectedJobIds);
  
      // Find the full job objects corresponding to the selected IDs
      const selectedJobs = jobOpenings.filter(job => newSelectedJobIds.has(job.record_id));
      onSelectionChange(selectedJobs);
  
      // TODO: Decide if full job details need to be fetched here using `getRecordDetails`
      // from the useLarkBase hook if `jobOpenings` only contains partial data.
      // For now, assumes `jobOpenings` has sufficient data (at least record_id and job_title).
  
    }, [selectedJobIds, jobOpenings, onSelectionChange]);
  
    return (
      <div className="mb-4 p-4 border rounded-md bg-white shadow-sm">
        <h3 className="font-panton-bold mb-3 text-lg">Select Existing Job Openings</h3>
        {jobOpenings.length === 0 && <p className="text-gray-500 italic">No existing job openings found in Lark Base.</p>}
        <div className="space-y-2 max-h-60 overflow-y-auto"> {/* Added scroll for long lists */}
          {jobOpenings.map((job) => (
            <div key={job.record_id} className="flex items-center">
              <input
                type="checkbox"
                id={`job-${job.record_id}`}
                value={job.record_id}
                checked={selectedJobIds.has(job.record_id)}
                onChange={handleCheckboxChange}
                disabled={disabled}
                className="h-4 w-4 text-[#37A533] focus:ring-[#37A533] border-gray-300 rounded disabled:opacity-50" // Accent color
              />
              <label
                htmlFor={`job-${job.record_id}`}
                className={`ml-2 block text-sm ${disabled ? 'text-gray-500' : 'text-gray-900'}`}
              >
                {job.job_title || `Job ID: ${job.record_id}`} {/* Fallback display */}
              </label>
            </div>
          ))}
        </div>
         {/* Optional: Display count of selected items */}
         {/* {selectedJobIds.size > 0 && (
           <p className="text-sm text-gray-600 mt-2">{selectedJobIds.size} job(s) selected.</p>
         )} */}
      </div>
    );
  };

  export default ExistingJobSelector;