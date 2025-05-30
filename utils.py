import yaml
import os
import logging
import tempfile
from pathlib import Path
from threading import Lock
from typing import Any, Literal, Dict, AnyStr, List, Tuple, Annotated
from pydantic import BaseModel, create_model
from fastapi import UploadFile

# from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain.schema import Document

# INTERNAL IMPORTS
from data_models import ResumeFeedback

logger = logging.getLogger(__name__) 

# CACHE MANAGER CLASS
class CacheManager:
    _instance = None
    _lock = Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._cache = {}
            return cls._instance
    
    def set(self, key: str, value: Any) -> None:
        """SET A VARIABLE IN THE CACHE"""
        self._cache[key] = value
        print(f"---{key} ADDED IN CACHE---")
    
    def get(self, key: str, default = None) -> Any:
        """GET A VARIABLE FROM THE CACHE"""
        print(f"---GETTING {key} FROM CACHE---")
        return self._cache.get(key, default)

    def has(self, key: str) -> bool:
        """CHECK IF A VARIABLE EXISTS IN THE CACHE"""
        return key in self._cache
    
    def clear(self, key: str = None) -> None:
        """CLEAR A CATEGORY FROM THE CACHE"""
        if key:
            self._cache.pop(key, None)
            print(f"---{key} CLEARED FROM CACHE---")
        else:
            self._cache = {}
            print(f"---ALL CATEGORIES CLEARED FROM CACHE---")
    
    def append_to_list(self, key: str, value: Any) -> bool:
        """APPEND A VALUE TO A LIST IN THE CACHE"""
        if key in self._cache:
            if isinstance(self._cache[key], list):
                self._cache[key].append(value)
                print(f"---APPENDED VALUE TO {key} IN CACHE---")
                return True
            else:
                print(f"---ERROR: {key} IS NOT A LIST---")
                return False
        else:
            self._cache[key] = [value]
            print(f"---CREATED NEW LIST WITH VALUE IN {key}---")
            return True

    def remove_from_list(self, key: str, value: Any) -> bool:
        """REMOVE A VALUE FROM A LIST IN THE CACHE"""
        if key in self._cache and isinstance(self._cache[key], list):
            try:
                self._cache[key].remove(value)
                print(f"---REMOVED VALUE FROM {key} IN CACHE---")
                return True
            except ValueError:
                print(f"---VALUE NOT FOUND IN {key}---")
                return False
        else:
            print(f"---ERROR: {key} NOT FOUND OR NOT A LIST---")
            return False

# FUNCTION TO LOAD PROMPTS
def load_prompts(path: Path) -> dict:
    print(f"---LOADING PROMPTS FROM {path}---")
    with open(path, 'r') as file:
        prompts = yaml.safe_load(file)
    return prompts

# FUNCTION TO LOAD AND PROCESS JOB DESCRIPTION TXT FILES FROM DIRECTORY
def process_directory(directory_path, file_content):
    results = []
    
    if file_content == "job_description":
        # Process TXT files for job descriptions
        for file in os.listdir(directory_path):
            if file.endswith(".txt"):
                file_path = os.path.join(directory_path, file)
                with open(file_path, "r") as f:
                    content = f.read()
                    results.append({
                        "name": file,
                        "content": content
                    })
    elif file_content == "resume":
        # Process PDF files for resumes
        for file in os.listdir(directory_path):
            if file.endswith(".pdf"):
                file_path = os.path.join(directory_path, file)
                # Use your PDF processing logic here
                # For example:
                try:
                    # Extract text from PDF
                    loader = PyPDFLoader(str(file_path))
                    pdf_documents = loader.load()

                    # Combine all pages into a single document
                    full_text = "\n".join([doc.page_content for doc in pdf_documents])

                    results.append(Document(
                        page_content=full_text,
                        metadata={"source": file}
                    ))
                except Exception as e:
                    raise RuntimeError(f"Error reading resume file {file_path.name}: {str(e)}")
    
    return results

# FUNCTION TO FLATTEN RESUME FEEDBACK RANKINGS AND JOB DESCRIPTIONS
# def flatten(all_rankings: Dict[AnyStr, List[ResumeFeedback]], jobs: List[Dict[AnyStr, AnyStr]]):
#     try:
#         flattened_string = ""
#         num_jobs = len(jobs)

#         for job in jobs:
#             num_jobs -= 1
#             print(f'---FLATTENING {job.get("name")} ({num_jobs} LEFT)---')
#             flattened_job_description = f"# Job Openings: \nFileName: {job.get('name')}\n{job.get('content')}\n\n# Resume Ranking and Analysis:"
#             flattened_candidates = ""
#             for job_name, ranking in all_rankings.items():
#                 if job_name == job.get("name"):
#                     for idx, candidate in enumerate(ranking):
#                         flattened_candidates += f"""\n## Rank {idx+1}\n## Candidate Name: {candidate.candidate_name}
# ## Analysis: {candidate.analysis}
# ## Scores: {candidate.scores}
# ## Total Score: {candidate.total_score}
# ## Key Strengths: {candidate.key_strengths}
# ## Areas for Improvement: {candidate.areas_for_improvement}\n"""
                        
#                     flattened_string += f"{flattened_job_description}\n{flattened_candidates}\n"

#         return flattened_string
#     except Exception as e:
#         raise RuntimeError(f"Error flattening rankings and job descriptions: {str(e)}")

# (OPENAI/GEMINI) FUNCTION TO FLATTEN RESUME FEEDBACK RANKINGS AND JOB DESCRIPTIONS
def flatten(all_rankings: List[Tuple[AnyStr, List[ResumeFeedback]]], jobs: List[Dict[AnyStr, AnyStr]]):
    try:
        flattened_string = ""

        for job in jobs:
            job_name = job.get("name", "")  # Default to empty string if name is missing
            job_content = job.get("content", "") # Default to empty string if content is missing.
            flattened_job_description = f"# Job Openings:\nFileName: {job_name}\n{job_content}\n\n# Resume Ranking and Analysis:"
            flattened_candidates = ""

            for ranking_job_name, ranking in all_rankings.items():
                if ranking_job_name == job_name:
                    for idx, candidate in enumerate(ranking):
                        try:
                            scores_str = '\n\t'.join([f'{key} - {value}' for key, value in candidate.scores.model_dump().items()])
                            flattened_candidates += f"""
## Rank {idx+1}
## Candidate Name: {candidate.candidate_name}
## Analysis: {candidate.analysis}
## Scores: {scores_str}
## Total Score: {candidate.total_score}
## Key Strengths: {candidate.key_strengths}
## Areas for Improvement: {candidate.areas_for_improvement}\n"""
                        except AttributeError as e:
                            print(f"Error processing candidate: {e}")
                        except KeyError as e:
                            print(f"Key Error processing candidate: {e}")
            flattened_string += f"{flattened_job_description}\n{flattened_candidates}\n"
        return flattened_string
    except Exception as e:
        raise RuntimeError(f"Error flattening rankings and job descriptions: {str(e)}")


# FUNCTION TO SETUP VECTOR STORE
# def setup_vector_store(cache_manager: CacheManager):
#     print(f"---SETTING UP VECTOR STORE---")

#     # SET EMBEDDING MODEL TO CACHE IF NOT ALREADY SET
#     if not cache_manager.has("embedding_model"):
#         embedding_model = HuggingFaceInferenceAPIEmbeddings(
#             api_key=os.getenv("HF_API_KEY"),
#             model_name="sentence-transformers/all-MiniLM-l6-v2"
#         )
#         cache_manager.set("embedding_model", embedding_model)
    
#     embedding_model = cache_manager.get("embedding_model")

#     # SET CHROMA VECTOR STORE TO CACHE IF NOT ALREADY SET
#     if not cache_manager.has("vector_store"):
#         vector_store = Chroma(
#             collection_name="resume_ranking",
#             embedding_function=embedding_model,
#             persist_directory="./chroma_db"
#         )
#         cache_manager.set("vector_store", vector_store)

#         return vector_store

# FUNCTION TO PROCESS INDIVIDUAL TXT FILES
def process_txt(txt_file):
    try:
        job_description_content = txt_file.getvalue().decode("utf-8")
        job_descriptions = [{
            "name": txt_file.name,
            "content": job_description_content
        }]
        print(f"Job description uploaded: {txt_file.name}")

        return job_descriptions
    except Exception as e:
        raise RuntimeError(f"Error reading job description file: {str(e)}")

# FUNCTION TO PROCESS PDFS
async def process_pdfs(pdf_files: List[UploadFile]) -> List[Document]: # Make the function async
    """Process multiple PDF files (UploadFile objects) and return a list of Documents"""
    documents = []

    for pdf_file in pdf_files:
        # Use a temporary directory to safely handle the file
        with tempfile.TemporaryDirectory() as temp_dir:
            # Use pdf_file.filename
            temp_file_path = os.path.join(temp_dir, pdf_file.filename)

            try:
                # Read the content from the UploadFile object asynchronously
                content = await pdf_file.read() # Use await pdf_file.read()

                # Write the content to the temp file
                with open(temp_file_path, "wb") as f:
                    f.write(content)

                # Extract text from the temporary PDF file path
                loader = PyPDFLoader(temp_file_path)
                pdf_documents = loader.load() # PyPDFLoader loads from the path

                # Combine all pages into a single document
                full_text = "\n".join([doc.page_content for doc in pdf_documents])

                # Use pdf_file.filename for the metadata source
                documents.append(Document(
                    page_content=full_text,
                    metadata={"source": pdf_file.filename}
                ))
                logger.info(f"Successfully processed: {pdf_file.filename}")

            except Exception as e:
                logger.error(f"Error processing file {pdf_file.filename}: {str(e)}")
                # Optionally re-raise or handle specific file errors
            finally:
                 # Ensure UploadFile is closed
                 await pdf_file.close()

    return documents

# FUNCTION TO PROCESS PDFS
# def process_pdfs(pdf_files):
#     """Process multiple PDF files and return a list of Documents"""
#     documents = []
    
#     for pdf_file in pdf_files:
#         temp_dir = tempfile.TemporaryDirectory()
#         temp_file_path = os.path.join(temp_dir.name, pdf_file.filename)
        
#         with open(temp_file_path, "wb") as f:
#             f.write(pdf_file.getbuffer())
        
#         # Extract text from PDF
#         loader = PyPDFLoader(temp_file_path)
#         pdf_documents = loader.load()
        
#         # Combine all pages into a single document
#         full_text = "\n".join([doc.page_content for doc in pdf_documents])
        
#         documents.append(Document(
#             page_content=full_text,
#             metadata={"source": pdf_file.filename}
#         ))
        
#         temp_dir.cleanup()
    
#     return documents


# FUNCTION TO DYNAMICALLY CREATE A PYDANTIC MODEL FROM A DICTIONARY
def _create_datamodel(model_name: str, fields: dict) -> BaseModel:
    model_name = model_name if " " not in model_name else model_name.replace(" ", "_").capitalize()
    return create_model(model_name, **fields)

# FUNCTION TO CLEAN INVALIDE CHARACTERS FOR A PYDANTIC MODEL FIELDS
def clean_fieldname(name: str) -> str:
    return "".join(c if c.isalnum() else '_' for c in name)            


