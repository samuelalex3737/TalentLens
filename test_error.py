import asyncio
from backend.main import analyze_resumes
from fastapi import UploadFile
import os
from sqlalchemy.orm import Session
from backend.database import SessionLocal

async def test():
    db = SessionLocal()
    try:
        with open('Sample Resume/CV 2.0.pdf', 'rb') as f:
            content = f.read()
            
        # Reopen or mock UploadFile
        f = open('Sample Resume/CV 2.0.pdf', 'rb')
        upload_file = UploadFile(filename='CV 2.0.pdf', file=f)
        
        await analyze_resumes('Test Job Description', None, [upload_file], db)
    finally:
        db.close()

if __name__ == '__main__':
    asyncio.run(test())
