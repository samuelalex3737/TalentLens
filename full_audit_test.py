"""
TalentLens Full Audit Test
Tests the complete API pipeline with 10 sample resumes.
"""
import httpx
import os
import time
import json
import sys

BASE_URL = "http://localhost:8000"
RESUME_DIR = r"C:\Users\Samuel\OneDrive\Desktop\TalentLens\Sample Resume"

JOB_TITLE = "Senior AI Data Analyst"
JOB_DESCRIPTION = """
3-5 Years Experience
Company: QuantumEdge Analytics
Location: Dubai (Hybrid)
Experience Required: 3-5 Years
Employment Type: Full-Time
Salary Range: AED 14,000 - AED 20,000/month

About the Role
QuantumEdge Analytics is looking for a highly analytical and AI-driven Senior AI Data Analyst to help transform enterprise data into intelligent business solutions. This role combines traditional data analytics with modern AI technologies, including machine learning, automation, and generative AI systems.
The ideal candidate should have experience working with large datasets, building predictive analytics solutions, evaluating AI model outputs, and translating complex data into executive-level dashboards and reports.

Key Responsibilities:
- Analyze large-scale structured and unstructured datasets
- Build and maintain predictive models using Python
- Develop executive-level dashboards using Power BI or Tableau
- Evaluate and integrate AI/ML model outputs
- Collaborate with cross-functional teams

Required Skills:
- Strong proficiency in Python (Pandas, NumPy, Scikit-Learn, Matplotlib)
- Hands-on experience with Power BI, Tableau, or Streamlit
- Experience with SQL and NoSQL databases
- Knowledge of machine learning algorithms
- Strong communication and presentation skills
"""

def main():
    print("=" * 70)
    print("TALENTLENS FULL AUDIT TEST")
    print("=" * 70)

    # 1. Check backend health
    print("\n[1] Checking backend health...")
    try:
        r = httpx.get(f"{BASE_URL}/docs", timeout=5)
        print(f"    Backend status: {r.status_code} {'OK' if r.status_code == 200 else 'FAIL'}")
    except Exception as e:
        print(f"    CRITICAL: Backend not responding: {e}")
        sys.exit(1)

    # 2. List resumes
    print(f"\n[2] Loading resumes from: {RESUME_DIR}")
    resume_files = [f for f in os.listdir(RESUME_DIR) if f.lower().endswith('.pdf')]
    print(f"    Found {len(resume_files)} resumes:")
    for i, f in enumerate(resume_files, 1):
        size = os.path.getsize(os.path.join(RESUME_DIR, f))
        print(f"    {i:2d}. {f} ({size/1024:.0f} KB)")

    # 3. Submit analysis
    print(f"\n[3] Submitting {len(resume_files)} resumes for analysis...")
    files = []
    for f in resume_files:
        path = os.path.join(RESUME_DIR, f)
        files.append(("resumes", (f, open(path, "rb"), "application/pdf")))

    start_time = time.time()
    try:
        with httpx.Client(timeout=300) as client:
            r = client.post(
                f"{BASE_URL}/api/analyze",
                data={"job_title": JOB_TITLE, "job_description": JOB_DESCRIPTION},
                files=files,
            )
        elapsed = time.time() - start_time
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"    CRITICAL: API request failed after {elapsed:.1f}s: {e}")
        sys.exit(1)

    print(f"    Response: HTTP {r.status_code} in {elapsed:.1f}s")

    if r.status_code != 200:
        print(f"    FAIL: {r.text[:500]}")
        sys.exit(1)

    data = r.json()
    session_id = data.get("session_id")
    candidates = data.get("candidates", [])

    # 4. Validate response structure
    print(f"\n[4] Validating response structure...")
    print(f"    Session ID: {session_id}")
    print(f"    Job Title: {data.get('job_title')}")
    print(f"    Total Candidates: {data.get('total_candidates')}")

    summary = data.get("summary", {})
    print(f"    Summary: avg={summary.get('avg_score')}, max={summary.get('max_score')}, "
          f"min={summary.get('min_score')}, conflicts={summary.get('conflict_count')}")

    # 5. Audit each candidate
    print(f"\n[5] Auditing {len(candidates)} candidates...")
    issues = []
    ai_scored = 0
    ai_failed = 0

    for c in candidates:
        rank = c.get("final_rank", "?")
        name = c.get("candidate_name", "MISSING")
        score = c.get("final_score", 0)
        tfidf = c.get("tfidf_score", 0)
        semantic = c.get("semantic_score", 0)
        provider = c.get("ai_provider", "none")
        model = c.get("ai_model", "none")
        summary_text = c.get("candidate_summary", "")
        matched = c.get("matched_skills", [])
        missing = c.get("missing_skills", [])
        transferable = c.get("transferable_skills", [])
        rec = c.get("hiring_recommendation", "")
        education = c.get("education", [])
        experience = c.get("experience", [])
        certs = c.get("certifications", [])
        email = c.get("email")
        phone = c.get("phone")
        linkedin = c.get("linkedin")
        github = c.get("github")
        bias_risk = c.get("bias_risk", "")
        red_flags = c.get("red_flags", [])

        has_ai = semantic > 0
        if has_ai:
            ai_scored += 1
        else:
            ai_failed += 1

        print(f"\n    #{rank} {name}")
        print(f"       Final: {score:.1f} | TF-IDF: {tfidf:.1f} | AI: {semantic} | Provider: {provider}/{model}")
        print(f"       Rec: {rec} | Bias: {bias_risk}")
        print(f"       Email: {email} | Phone: {phone}")
        print(f"       LinkedIn: {'Yes' if linkedin else 'No'} | GitHub: {'Yes' if github else 'No'}")
        print(f"       Education: {len(education)} items | Experience: {len(experience)} items | Certs: {len(certs)}")
        print(f"       Matched: {len(matched)} | Missing: {len(missing)} | Transferable: {len(transferable)}")
        print(f"       Summary: {summary_text[:80]}..." if len(summary_text) > 80 else f"       Summary: {summary_text}")

        # Check for issues
        if name == "MISSING" or name == "Unknown Candidate":
            issues.append(f"#{rank}: Name extraction failed")
        if not email:
            issues.append(f"#{rank} {name}: No email extracted")
        if semantic == 0 and provider == "none":
            issues.append(f"#{rank} {name}: AI scoring FAILED (score=0.0)")
        if not summary_text or summary_text == "AI scoring unavailable.":
            issues.append(f"#{rank} {name}: No AI summary generated")
        if len(matched) == 0 and len(missing) == 0:
            issues.append(f"#{rank} {name}: No skills analysis (matched=0, missing=0)")
        if not rec:
            issues.append(f"#{rank} {name}: Missing hiring recommendation")

    # 6. Test history endpoints
    print(f"\n[6] Testing history endpoints...")
    try:
        r = httpx.get(f"{BASE_URL}/api/sessions", timeout=10)
        sessions = r.json()
        print(f"    GET /api/sessions: {r.status_code} - {len(sessions)} sessions found")

        if session_id:
            r = httpx.get(f"{BASE_URL}/api/session/{session_id}", timeout=10)
            session_data = r.json()
            history_candidates = session_data.get("candidates", [])
            print(f"    GET /api/session/{session_id[:8]}...: {r.status_code} - {len(history_candidates)} candidates")

            # Check if order is preserved
            history_ranks = [c.get("final_rank") for c in history_candidates]
            is_sorted = all(history_ranks[i] <= history_ranks[i+1] for i in range(len(history_ranks)-1))
            print(f"    History order preserved: {'YES' if is_sorted else 'NO - RANKING BUG!'}")
            if not is_sorted:
                issues.append("History endpoint returns candidates in wrong order")
    except Exception as e:
        print(f"    FAIL: {e}")
        issues.append(f"History endpoints failed: {e}")

    # 7. Test export endpoint
    print(f"\n[7] Testing CSV export...")
    try:
        r = httpx.get(f"{BASE_URL}/api/export/{session_id}", timeout=10)
        print(f"    GET /api/export: {r.status_code}")
        if r.status_code == 200:
            csv_lines = r.text.strip().split("\n")
            print(f"    CSV rows: {len(csv_lines)} (header + {len(csv_lines)-1} candidates)")
        else:
            issues.append(f"CSV export failed: HTTP {r.status_code}")
    except Exception as e:
        print(f"    FAIL: {e}")
        issues.append(f"CSV export failed: {e}")

    # 8. Test interview questions endpoint
    print(f"\n[8] Testing interview questions...")
    if candidates:
        first_id = candidates[0].get("id")
        try:
            r = httpx.get(f"{BASE_URL}/api/candidates/{first_id}/questions", timeout=30)
            print(f"    GET /api/candidates/{first_id[:8]}../questions: {r.status_code}")
            if r.status_code == 200:
                questions = r.json()
                print(f"    Generated {len(questions)} interview questions")
            else:
                issues.append(f"Interview questions failed: HTTP {r.status_code}")
        except Exception as e:
            print(f"    FAIL: {e}")
            issues.append(f"Interview questions failed: {e}")

    # 9. Test edge cases
    print(f"\n[9] Testing edge cases...")

    # Empty submission
    try:
        r = httpx.post(f"{BASE_URL}/api/analyze", data={"job_title": "", "job_description": ""}, timeout=10)
        print(f"    Empty submission: HTTP {r.status_code} {'(correctly rejected)' if r.status_code >= 400 else '(SHOULD REJECT!)'}")
        if r.status_code < 400:
            issues.append("Empty submission not rejected by backend")
    except Exception as e:
        print(f"    Empty submission: Exception {e}")

    # Invalid session ID
    try:
        r = httpx.get(f"{BASE_URL}/api/session/fake-id-12345", timeout=5)
        print(f"    Invalid session ID: HTTP {r.status_code} {'(correctly 404)' if r.status_code == 404 else '(WRONG STATUS!)'}")
        if r.status_code != 404:
            issues.append(f"Invalid session ID returned {r.status_code} instead of 404")
    except Exception as e:
        issues.append(f"Invalid session test failed: {e}")

    # Delete session
    print(f"\n[10] Testing session deletion...")
    try:
        r = httpx.delete(f"{BASE_URL}/api/session/{session_id}", timeout=10)
        print(f"    DELETE /api/session: {r.status_code}")
        if r.status_code == 200:
            # Verify it's gone
            r2 = httpx.get(f"{BASE_URL}/api/session/{session_id}", timeout=5)
            print(f"    Verify deleted: HTTP {r2.status_code} {'(correctly 404)' if r2.status_code == 404 else '(STILL EXISTS!)'}")
            if r2.status_code != 404:
                issues.append("Deleted session still accessible")
        else:
            issues.append(f"Session deletion failed: HTTP {r.status_code}")
    except Exception as e:
        issues.append(f"Session deletion failed: {e}")

    # FINAL REPORT
    print("\n" + "=" * 70)
    print("AUDIT SUMMARY")
    print("=" * 70)
    print(f"Total resumes tested:     {len(resume_files)}")
    print(f"Total candidates scored:  {len(candidates)}")
    print(f"AI scoring successful:    {ai_scored}/{len(candidates)}")
    print(f"AI scoring failed:        {ai_failed}/{len(candidates)}")
    print(f"Processing time:          {elapsed:.1f}s ({elapsed/len(resume_files):.1f}s per resume)")
    print(f"Total issues found:       {len(issues)}")

    if issues:
        print(f"\nISSUES FOUND:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
    else:
        print(f"\nNO ISSUES FOUND - ALL TESTS PASSED!")

    print("=" * 70)

if __name__ == "__main__":
    main()
