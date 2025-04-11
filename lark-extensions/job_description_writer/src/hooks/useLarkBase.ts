import { useState, useEffect } from 'react';
import { bitable, ITextField, ITable, IRecordValue } from '@lark-base-open/js-sdk';
import { JobDescription } from '../types/index';

export function useLarkBase() {
  const [table, setTable] = useState<ITable>();
  const [nameField, setNameField] = useState<string>('');
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeLarkBase = async () => {
      try {
        setLoading(true);
        
        // Get the ①Recruitment Request Management table
        const rrmTable = await bitable.base.getTableByName('①Recruitment Request Management Copy');
        if (!rrmTable) return setError('---FAILED TO GET ①Recruitment Request Management TABLE---')
        setTable(rrmTable);
        
        // Get all fields to map field names to field IDs
        const fields = await rrmTable.getFieldMetaList();
        // console.log(`---FIELDS: ${JSON.stringify(fields)}---`)
        
        const fieldMapping: Record<string, string> = {};
        const fieldsToSkip = ['HR Name', 'Status', '③Recruitment Progress Management', 'Requester'];
        /**
         * CITY FIELD => 3 => SINGLE OPTION
         * HR NAME FIELD => 11 (TO BE SKIPPED)
         * JOB DUTIES FIELD => 1 => TEXT
         * RECRUITMENT TYPE FIELD => 3 => SINGLE OPTION
         * REQUIRED QUALIFICATIONS FIELD => 1 => TEXT
         * POSITION FIELD => 1 => TEXT
         * DEPARTMENT FIELD => 3 => SINGLE OPTION
         * RECRUITMENT PROGRESS MANAGEMENT FIELD => 21 => TWO-WAY LINK (TO BE SKIPPED)
         * STATUS FIELD => 3 => SINGLE OPTION (TO BE SKIPPED)
         * SALARY AND BENEFITS FIELD => 1 => TEXT
         * REQUESTER FIELD => 11 => PERSON (TO BE SKIPPED)
         * EXPECTED START DATE FIELD => 5 => DATE
         * JOB DESCRIPTION FIELD => 1 => TEXT
         */
        for (const field of fields) {
          // SKIP FIELDS THAT ARE NOT REQUIRED
          if (fieldsToSkip.includes(field.name)){
            console.log(`---SKIPPING FIELD: ${field.name}---`);
            continue;
          }

          // MAP FIELD NAMES TO FIELD IDs
          if (field.name.toLowerCase().includes('position')) {
            fieldMapping['jobPosition'] = field.id
          } else if (field.name.toLowerCase().includes('job description')) {
            fieldMapping['jobDescription'] = field.id
          } else if (field.name.toLowerCase().includes('city')) {
            fieldMapping['jobLocation'] = field.id
          } else if (field.name.toLowerCase().includes('department')) {
            fieldMapping['department'] = field.id;
          } else if (field.name.toLowerCase().includes('recruitment type')) {
            fieldMapping['jobType'] = field.id;
          } else if (field.name.toLowerCase().includes('job duties')) {
            fieldMapping['jobDuties'] = field.id;
          } else if (field.name.toLowerCase().includes('required qualifications')) {
            fieldMapping['jobQualification'] = field.id;
          } else if (field.name.toLowerCase().includes('salary and benefits')) {
            fieldMapping['jobBenefits'] = field.id;
          } else if (field.name.toLowerCase().includes('expected start date')) {
            fieldMapping['expectedStartDate'] = field.id;
          } else {
            fieldMapping[field.name] = field.id;
          }

          // Create a mapping of common field names to their IDs
          // if (field.name.toLowerCase().includes('job description')) {
          //   fieldMapping['jobDescription'] = field.id;
          // } else if (field.name.toLowerCase().includes('job position') || 
          //           field.name.toLowerCase().includes('position') || 
          //           field.name.toLowerCase().includes('title')) {
          //   fieldMapping['jobPosition'] = field.id;
          // } else if (field.name.toLowerCase().includes('expiry') || 
          //           field.name.toLowerCase().includes('expiration') || 
          //           field.name.toLowerCase().includes('deadline')) {
          //   fieldMapping['jobExpiryDate'] = field.id;
          // }
        }
        
        setFieldMap(fieldMapping);
        setLoading(false);
      } catch (err) {
        console.error('Error initializing Lark Base:', err);
        setError('Failed to initialize Lark Base. Please refresh and try again.');
        setLoading(false);
      }
    };

    initializeLarkBase();
  }, []);

  const updateRecords = async (jobDescriptions: JobDescription[]) => {
    if (!table) {
      throw new Error('Table not initialized');
    }

    try {
      // Consider fetching all existing job titles ONCE before the loop for efficiency
      const existingTitles = new Set();
      const recordList = await table.getRecordList();
      if (recordList) {
          for (const record of Array.from(recordList)) {
              try {
                  const positionCell = await record.getCellByField(fieldMap.jobPosition);
                  const positionValue = await positionCell.getValue();
                  // Ensure positionValue is treated as a string if it's plain text
                  if (positionValue && typeof positionValue === 'string') {
                      existingTitles.add(positionValue);
                  } else if (Array.isArray(positionValue) && positionValue[0]?.text) {
                      // Handle cases where getValue returns [{type: 'text', text: '...'}]
                      existingTitles.add(positionValue[0].text);
                  }
              } catch (cellError) {
                  console.error(`Error getting cell value for record ${record.id}:`, cellError);
              }
          }
      }
      console.log('Existing Job Titles:', existingTitles);

      const recordPromises = jobDescriptions.map(async (job) => {
          // CHECK IF POSITION FIELD ALREADY CONTAINS THE CURRENT JOB TITLE
          if (existingTitles.has(job.job_title)) {
              console.log(`---SKIPPING JOB TITLE: ${job.job_title} AS IT ALREADY EXISTS---`);
              return null; // Skip this job
          }

          const recordData: Record<string, any> = {};

          // --- Map fields based on their TYPE ---

          if (fieldMap.jobPosition && job.job_title) {
              recordData[fieldMap.jobPosition] = job.job_title;
          }

          if (fieldMap.jobDescription && job.finalized_job_description) {
              // For simple text, direct assignment is fine.
              // If it's rich text, you might need specific formatting - check SDK/API details if applicable.
              recordData[fieldMap.jobDescription] = job.finalized_job_description;
          }

          // SET JOB LOCATION IN LARK BASE
          if (fieldMap.jobLocation && job.job_location) {
            console.log(`---JOB LOCATION ID: ${fieldMap.job_location}`)
            recordData[fieldMap.jobLocation] = job.job_location;
          }

          // SET DEPARTMENT IN LARK BASE
          if (fieldMap.department && job.department) {
              recordData[fieldMap.department] = job.department;
          }

          // SET JOB DUTIES IN LARK BASE
          if (fieldMap.jobDuties && job.job_duties) {
              recordData[fieldMap.jobDuties] = job.job_duties;
          }

          // SET JOB QUALIFICATION IN LARK BASE
          if (fieldMap.jobQualification && job.job_qualification) {
              recordData[fieldMap.jobQualification] = job.job_qualification;
          }

          // SET EXPECTED START DATE IN LARK BASE
          if (fieldMap.expectedStartDate && job.expected_start_date) {
              recordData[fieldMap.expectedStartDate] = job.expected_start_date;
          }

          // SET JOB LOCATION IN LARK BASE
          if (fieldMap.jobLocation && job.job_location) {
              recordData[fieldMap.jobLocation] = job.job_location;
          }


          console.log(`---VALUE OF RECORDS: ${JSON.stringify(recordData)}---`);
          // --- End of Field Mapping ---

          // Add the record to the table if recordData is not empty
          if (Object.keys(recordData).length > 0) {
            console.log(`---ADDING JOB TITLE: ${job.job_title}---`, recordData);
            return table.addRecord({ fields: recordData });
          } else {
            console.log(`---SKIPPING JOB TITLE: ${job.job_title} - No data to add---`);
            return null;
          }
      });

      // Wait for all addRecord operations to complete
      const addedRecordResults = await Promise.all(recordPromises);

      // Filter out null results (skipped jobs)
      const actualAddedRecords = addedRecordResults.filter(result => result !== null);

      console.log(`Successfully added ${actualAddedRecords.length} records.`);
      // You can inspect actualAddedRecords for the IDs of the newly created records


      // For each job description, create a new record
      // const recordPromises = jobDescriptions.map(async (job) => {
      //   const recordData: Record<string, any> = {};
        
      //   // CHECK IF POSITION FIELD ALREADY CONTAINS THE CURRENT JOB TITLE
      //   const recordList = await table.getRecordList();
      //   if (recordList) {
      //     for (const record of Array.from(recordList)) {
      //       const positionField = await record.getCellByField(fieldMap.jobPosition);
      //       const positionFieldValue = await positionField.getValue();
      //       console.log(`---POSITION FIELD VALUE: ${positionFieldValue} \n POSITION FIELD VALUE TYPE: ${typeof positionFieldValue}---`);
      //       // IF POSITION FIELD VALUE IS EQUAL TO JOB TITLE, SKIP THE RECORD
      //       if (positionField && positionFieldValue == job.job_title) {
      //         console.log(`---SKIPPING JOB TITLE: ${job.job_title} AS IT ALREADY EXISTS---`);
      //         return null;
      //       }
      //     }
      //   } else {
      //     // CREATE A NEW RECORD IF RECORD LIST IS EMPTY
      //     console.log('---RECORD LIST IS EMPTY---');

      //   }
        

      //   // Map the job description fields to the corresponding table fields
      //   if (fieldMap.jobDescription && job.finalized_job_description) {
      //     recordData[fieldMap.jobDescription] = job.finalized_job_description;
      //   }
        
      //   if (fieldMap.jobPosition && job.job_title) {
      //     recordData[fieldMap.jobPosition] = job.job_title;
      //   }
        
      //   if (fieldMap.jobLocation && job.job_location) {
      //     recordData[fieldMap.jobLocation] = job.job_location
      //   }
        
        
      //   // Add the record to the table
      //   return await table.addRecord({ fields: recordData });
      // });
      
      // // Wait for all records to be added
      // await Promise.all(recordPromises);
      
      // return true;
    } catch (err) {
      console.error('Error updating records:', err);
      throw new Error('Failed to update records in Lark Base');
    }
  };

  return {
    table,
    fieldMap,
    loading,
    error,
    updateRecords,
  };
}
