import { useState, useEffect } from 'react';
import { bitable, ITextField, ITable, IOpenSegment, IAttachmentField, IRecordList } from '@lark-base-open/js-sdk';
import { JobDescription, ExistingJobOpening, FileWithContent } from '../types/index';

export function useLarkBase() {
  const [table, setTable] = useState<ITable>();
  // const [existingAttachment, setAttachment] = useState<IOpenAttachment[]>([]);
  const [existingJobOpenings, setExistingJobOpenings] = useState<ExistingJobOpening[]>([]);
  const [existingRecordList, setRecordList] = useState<IRecordList>();
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeLarkBase = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get the ①Recruitment Request Management table
        const rrmTable = await bitable.base.getTableByName('①Recruitment Request Management Copy');
        if (!rrmTable) {
          setError('---FAILED TO GET ①Recruitment Request Management TABLE---');
          setLoading(false);
          return;
        }
        setTable(rrmTable);

        // GET RECORD LIST FROM THE TABLE AND ASSIGN TO STATE
        const recordList = await rrmTable.getRecordList();
        setRecordList(recordList)
        // console.log(`RECORD LIST: ${Array.from(recordList)}`)
        
        // Get all fields to map field names to field IDs
        const fields = await rrmTable.getFieldMetaList();
        
        const fieldMapping: Record<string, string> = {};
        const fieldsToSkip = ['HR Name', 'Status', '③Recruitment Progress Management', 'Requester'];
        // let positionFieldId: string | null = null;

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
          } else if (field.name.toLowerCase().includes('attachment')) {
            fieldMapping['attachment'] = field.id;
          } else {
            fieldMapping[field.name] = field.id;
          }

        }
        
        setFieldMap(fieldMapping);
        
        // FETCH EXISTING JOB OPENINGS
        if (rrmTable && (fieldMapping.jobPosition && recordList && fieldMapping.attachment)) {
          const fetchedOpenings: ExistingJobOpening[] = []
          for await (const record of Array.from(recordList)) {
            try {
              const positionField = await rrmTable.getField<ITextField>(fieldMapping.jobPosition);
              const positionCell = await positionField.getCell(record.id);
              const positionValue = await positionCell.getValue();
              let title = 'Untitled Position'; // DEFAULT

              // GET ATTACHMENT CELL
              // const attachmentCell = await record.getCellByField(fieldMapping.attachment);
              // const attachmentValue = await attachmentCell.getValue();
              // console.log(`FOUND ATTACHMENT: ${attachmentValue}`)
              
              // console.log(`---POSITION VALUE AND TYPE ${positionValue[0].text} - ${positionValue[0].type}---`)
              if (typeof positionValue === 'string') {
                title = positionValue;
                fetchedOpenings.push({
                  id: record.id,
                  position: title
                });
              } else {
                title = positionValue[0].text;
                console.log(`---CURRENT POSITION IS AN IOPENSEGMENT---`)
                fetchedOpenings.push({
                  id: record.id,
                  position: title
                });
              }

            } catch (cellError) {
              console.error(`ERROR GETTING POSITION CELL VALUE FOR RECORD ${record.id}:`, cellError);
            }
          }

        setExistingJobOpenings(fetchedOpenings);
        console.log('FETCHED EXISTING JOB OPENINGS: ', fetchedOpenings);
        setLoading(false);

        } else if (!fieldMapping.jobPosition) {
          console.warn("COULDN'T FIND THE `POSITION` FIELD ID TO FETCH EXISTING JOB OPENINGS.");
          setError("FAILED TO IDENTIFY THE `POSITION` FIELD IN THE RRM TABLE");
        }

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
      // GET EXISTING JOB OPENINGS FROM STATE
      const existingTitles = existingJobOpenings.map( existingJob => {
        return existingJob.position
      });

      // Consider fetching all existing job titles ONCE before the loop for efficiency
      // const existingTitles = new Set();

      // if (recordList) {
      //     for (const record of Array.from(recordList)) {
      //         try {
      //             const positionCell = await record.getCellByField(fieldMap.jobPosition);
      //             const positionValue = await positionCell.getValue();
      //             // Ensure positionValue is treated as a string if it's plain text
      //             if (positionValue && typeof positionValue === 'string') {
      //                 existingTitles.add(positionValue);
      //             } else if (Array.isArray(positionValue) && positionValue[0]?.text) {
      //                 // Handle cases where getValue returns [{type: 'text', text: '...'}]
      //                 existingTitles.add(positionValue[0].text);
      //             }
      //         } catch (cellError) {
      //             console.error(`Error getting cell value for record ${record.id}:`, cellError);
      //         }
      //     }
      // }
      console.log('Existing Job Titles:', existingTitles);

      const recordPromises = jobDescriptions.map(async (job) => {
          // CHECK IF POSITION FIELD ALREADY CONTAINS THE CURRENT JOB TITLE
          
          if (existingTitles.includes(job.job_title)) {
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
            try {
                const date = new Date(job.expected_start_date);
                if (!isNaN(date.getTime())) {
                    recordData[fieldMap.expectedStartDate] = date.getTime(); // Use timestamp
                } else {
                    console.warn(`Invalid date format for expected_start_date: ${job.expected_start_date}`);
                }
            } catch (dateError) {
                console.warn(`Error parsing date for expected_start_date: ${job.expected_start_date}`, dateError);
            }
          }

          // SET JOB LOCATION IN LARK BASE
          if (fieldMap.jobLocation && job.job_location) {
              recordData[fieldMap.jobLocation] = job.job_location;
          }


          // console.log(`---VALUE OF RECORDS: ${JSON.stringify(recordData)}---`);
          // --- End of Field Mapping ---

          // Add the record to the table if recordData is not empty
          if (Object.keys(recordData).length > 0) {
            console.log(`---ADDING JOB TITLE: ${job.job_title}---`, recordData);
            try {
                const addedRecord = await table.addRecord({ fields: recordData });
                return addedRecord; // Return the result (recordId)
            } catch (addError) {
                console.error(`---FAILED TO ADD JOB TITLE: ${job.job_title}---`, addError);
                return null; // Indicate failure for this specific record
            }
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
    existingJobOpenings,
    updateRecords,
  };
}
