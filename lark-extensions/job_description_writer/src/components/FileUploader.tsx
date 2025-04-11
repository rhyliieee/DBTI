import React, { useState, useRef } from 'react';
import { FileWithContent } from '../types';

interface FileUploaderProps {
  onFilesLoaded: (files: FileWithContent[]) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const processFiles = async (files: File[]) => {
    const textFiles = Array.from(files).filter(file => file.type === 'text/plain');
    
    if (textFiles.length === 0) {
      alert('Please select only .txt files');
      return;
    }
    
    setSelectedFiles(textFiles);
    
    const filesWithContent: FileWithContent[] = await Promise.all(
      textFiles.map(async (file) => {
        const content = await file.text();
        return { file, content };
      })
    );
    
    onFilesLoaded(filesWithContent);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full mb-6">
      <div
        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <svg
          className="w-12 h-12 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          ></path>
        </svg>
        <p className="text-sm text-gray-600 text-center font-quicksand">
          Drag and drop your .txt files here, or click to select files
        </p>
        <input
          type="file"
          className="hidden"
          accept=".txt"
          multiple
          ref={fileInputRef}
          onChange={handleFileInputChange}
        />
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold mb-2 font-panton">Selected Files:</h3>
          <ul className="text-sm space-y-1">
            {selectedFiles.map((file, index) => (
              <li key={index} className="font-quicksand">
                {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUploader;