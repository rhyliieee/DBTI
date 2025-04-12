// import React from 'react';
// import {RARDataModel} from '../types'

// interface AnalysisResultsTableProps {
//     results: RARDataModel[]; // Array of analysis results
//   }
  
//   const AnalysisResultsTable: React.FC<AnalysisResultsTableProps> = ({ results }) => {
//     if (!results || results.length === 0) {
//       // This case is handled in the parent, but good practice to include
//       return <p className="text-center text-gray-500 mt-4">No results to display.</p>;
//     }
  
//     return (
//       <div className="overflow-x-auto shadow-md rounded-lg">
//         <table className="w-full text-sm text-left text-gray-700 bg-white">
//           <thead className="text-xs text-gray-800 uppercase bg-gray-100 sticky top-0">
//             <tr>
//               <th scope="col" className="px-6 py-3">
//                 Candidate Name
//               </th>
//               <th scope="col" className="px-6 py-3 text-center"> {/* Centered score */}
//                 Match Score (%)
//               </th>
//               <th scope="col" className="px-6 py-3">
//                 Summary / Key Points
//               </th>
//                {/* Add other columns based on ResumeAnalysisResultItem structure if needed */}
//                {/* e.g., <th scope="col" className="px-6 py-3">Skills</th> */}
//             </tr>
//           </thead>
//           <tbody>
//             {results.map((item, index) => (
//               <tr key={item.candidate_name + index} className="border-b hover:bg-gray-50"> {/* Use unique key if possible */}
//                 <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
//                   {item.candidate_name || 'N/A'}
//                 </td>
//                 <td className="px-6 py-4 text-center font-medium"> {/* Centered score */}
//                    {/* Format score nicely */}
//                   <span className={`px-2 py-1 rounded text-xs font-bold ${
//                     item.match_score >= 75 ? 'bg-green-100 text-green-800' :
//                     item.match_score >= 50 ? 'bg-yellow-100 text-yellow-800' :
//                     'bg-red-100 text-red-800'
//                    }`}>
//                        {item.match_score !== undefined ? item.match_score.toFixed(1) : 'N/A'}%
//                   </span>
//                 </td>
//                 <td className="px-6 py-4 text-gray-600">
//                   {item.summary || 'No summary available.'}
//                 </td>
//                  {/* Render other data cells here */}
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     );
//   };

// export default AnalysisResultsTable;