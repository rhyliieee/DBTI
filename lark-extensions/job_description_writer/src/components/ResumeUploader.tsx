import React from 'react';

interface ResumeUploaderProps {
    onFilesLoaded: (files: FileWithContent[]) => void; // Expects files with content
    disabled?: boolean;
  }
  
  const ResumeUploader: React.FC<ResumeUploaderProps> = ({ onFilesLoaded, disabled }) => {
    const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  
    const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files) {
        const fileList = Array.from(files);
  
        // Filter for PDF files ONLY on the client-side as well
        const pdfFiles = fileList.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  
        setSelectedFileNames(pdfFiles.map(f => f.name));
  
        // --- IMPORTANT ---
        // The parent component expects `FileWithContent[]`.
        // This placeholder *does not* read the file content.
        // You need to implement file reading here (e.g., using FileReader API)
        // to populate the 'content' field before calling onFilesLoaded.
        // For now, we create mock objects.
        const filesWithMockContent: FileWithContent[] = pdfFiles.map(file => ({
          file: file,
          content: null, // Placeholder: Replace with actual content read via FileReader
        }));
        // --- End Important ---
  
        console.log("ResumeUploader: Passing mock FileWithContent objects up:", filesWithMockContent);
        onFilesLoaded(filesWithMockContent);
  
          // Optional: Provide feedback if non-PDF files were ignored
          if (pdfFiles.length !== fileList.length) {
              alert("Some selected files were not PDFs and have been ignored.");
          }
  
        // Reset input value to allow re-uploading the same file(s) if needed
        event.target.value = '';
      }
    }, [onFilesLoaded]);
  
    return (
      <div>
        <label
          htmlFor="resume-upload"
          className={`w-full flex justify-center items-center px-4 py-6 bg-white text-[#37A533] rounded-lg shadow border border-dashed border-[#37A533] cursor-pointer hover:bg-green-50 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <svg className="w-6 h-6 mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z" />
          </svg>
          <span className="text-base leading-normal font-quicksand">
            {selectedFileNames.length > 0
              ? `${selectedFileNames.length} file(s) selected`
              : 'Select PDF Resume Files'}
          </span>
          <input
            id="resume-upload"
            type="file"
            className="hidden"
            accept=".pdf,application/pdf" // Restrict to PDF
            multiple // Allow multiple files
            onChange={handleFileChange}
            disabled={disabled}
          />
        </label>
        {/* Optionally display the names of selected files */}
        {selectedFileNames.length > 0 && (
          <div className="mt-3 text-xs text-gray-600">
            <p className='font-semibold'>Selected:</p>
            <ul className='list-disc list-inside'>
              {selectedFileNames.map((name, index) => <li key={index}>{name}</li>)}
            </ul>
          </div>
        )}
         {/* Add feedback for invalid file types if needed */}
      </div>
    );
  };

  export default ResumeUploader;