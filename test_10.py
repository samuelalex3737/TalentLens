import requests
import glob
import os
import time

jd = '''
AI Data Analyst (2-4 Years Experience)
Company: Horizon AI Solutions
Location: Bangalore (Hybrid)
Experience Required: 2-4 Years
Employment Type: Full-Time
Salary Range: 8-14 LPA (Depending on experience)

About the Role
We are seeking a data-driven AI Data Analyst to bridge the gap between traditional data analytics and modern artificial intelligence. In this role, you won't just report on what happened in the past-you will build predictive models, analyze unstructured AI outputs, and implement machine learning workflows to forecast business trends.
You will work alongside Data Scientists and Product Managers to clean massive datasets, evaluate model performance, and deploy automated data pipelines that drive real-time decision-making.

Key Responsibilities
Predictive Analytics: Clean, preprocess, and analyze large-scale structured and unstructured datasets to build predictive models.
AI Feature Engineering: Collaborate with data engineers to identify, extract, and engineer high-quality features for Machine Learning (ML) models.
Model Evaluation: Track, monitor, and evaluate the performance of AI/ML models in production.
Advanced Data Wrangling: Write complex Python scripts and SQL queries.
'''

resume_files = glob.glob(r'C:\Users\Samuel\OneDrive\Desktop\TalentLens\Sample Resume\*.pdf')
print(f'Found {len(resume_files)} resumes. Sending to API...')

files = [('resumes', (os.path.basename(f), open(f, 'rb'), 'application/pdf')) for f in resume_files]
data = {'job_description': jd, 'job_title': 'AI Data Analyst'}

start = time.time()
try:
    resp = requests.post('http://localhost:8000/api/analyze', data=data, files=files, timeout=120)
    print('Status:', resp.status_code)
    if resp.status_code == 200:
        res = resp.json()
        print('Total Candidates:', res.get('total_candidates'))
        for c in res.get('candidates', []):
            print(f"{c['final_rank']}. {c['candidate_name']} - TF-IDF: {c['tfidf_score']}, AI: {c['semantic_score']}, Final: {c['final_score']} (Model: {c['ai_model']})")
    else:
        print(resp.text)
except Exception as e:
    print('Error:', e)
finally:
    for _, (name, f, _) in files:
        f.close()
print(f'Time taken: {time.time() - start:.2f} seconds')
