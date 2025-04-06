// Global variables
let resumeText = '';
let currentQuestionIndex = 0;
let interviewQuestions = [];
let userAnswers = [];
let feedbackResponses = [];
const totalQuestions = 20;
let groqApiKey = ''; // Will be set from environment or input

// DOM Elements
const dropArea = document.getElementById('drop-area');
const fileElem = document.getElementById('fileElem');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const removeFileBtn = document.getElementById('remove-file');
const jobDetails = document.getElementById('job-details');
const startInterviewBtn = document.getElementById('start-interview');
const uploadSection = document.getElementById('upload-section');
const interviewSection = document.getElementById('interview-section');
const questionCounter = document.getElementById('question-counter');
const loadingIndicator = document.getElementById('loading-indicator');
const questionContainer = document.getElementById('question-container');
const answerInput = document.getElementById('answer-input');
const submitAnswerBtn = document.getElementById('submit-answer');
const skipQuestionBtn = document.getElementById('skip-question');
const feedbackSection = document.getElementById('feedback-section');
const feedbackContainer = document.getElementById('feedback-container');
const nextQuestionBtn = document.getElementById('next-question');
const interviewComplete = document.getElementById('interview-complete');
const performanceSummary = document.getElementById('performance-summary');
const restartInterviewBtn = document.getElementById('restart-interview');
const downloadSummaryBtn = document.getElementById('download-summary');
const apiKeyInput = document.getElementById('groq-api-key');
const saveApiKeyBtn = document.getElementById('save-api-key');

// Initialize event listeners when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeDropArea();
    initializeFormHandlers();
    initializeInterviewHandlers();
    loadApiKey();
});

// Load API key from localStorage if available
function loadApiKey() {
    const savedKey = localStorage.getItem('groqApiKey');
    if (savedKey) {
        groqApiKey = savedKey;
        if (apiKeyInput) {
            apiKeyInput.value = savedKey;
        }
    }
    
    // Check if API key is provided via environment variable
    if (window.ENV && window.ENV.GROQ_API_KEY) {
        groqApiKey = window.ENV.GROQ_API_KEY;
    }
}

// Save API key to localStorage
function saveApiKey(key) {
    if (key) {
        localStorage.setItem('groqApiKey', key);
        groqApiKey = key;
    }
}

// Set up drag and drop functionality for resume upload
function initializeDropArea() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    dropArea.addEventListener('drop', handleDrop, false);
    fileElem.addEventListener('change', handleFiles, false);
    removeFileBtn.addEventListener('click', removeFile, false);
}

// Initialize form-related event handlers
function initializeFormHandlers() {
    // Enable start button when file is uploaded and processed successfully
    startInterviewBtn.addEventListener('click', startInterview);
    
    // Save API key if button exists
    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', () => {
            const key = apiKeyInput.value.trim();
            if (key) {
                saveApiKey(key);
                alert('API key saved successfully!');
            } else {
                alert('Please enter a valid API key');
            }
        });
    }
}

// Initialize interview-related event handlers
function initializeInterviewHandlers() {
    submitAnswerBtn.addEventListener('click', submitAnswer);
    skipQuestionBtn.addEventListener('click', skipQuestion);
    nextQuestionBtn.addEventListener('click', loadNextQuestion);
    restartInterviewBtn.addEventListener('click', restartInterview);
    downloadSummaryBtn.addEventListener('click', downloadSummary);
}

// Prevent default drag and drop behavior
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop area when file is dragged over
function highlight() {
    dropArea.classList.add('highlight');
}

// Remove highlight when file leaves drop area
function unhighlight() {
    dropArea.classList.remove('highlight');
}

// Handle file drop
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

// Process uploaded files
function handleFiles(e) {
    const files = e.target.files || e;
    if (files.length) {
        const file = files[0];
        fileName.textContent = file.name;
        fileInfo.style.display = 'block';
        jobDetails.style.display = 'block';
        processFile(file);
    }
}

// Remove uploaded file
function removeFile() {
    fileElem.value = '';
    fileName.textContent = '';
    fileInfo.style.display = 'none';
    jobDetails.style.display = 'none';
    resumeText = '';
    startInterviewBtn.disabled = true;
}

// Process different file formats
async function processFile(file) {
    try {
        const fileType = file.name.split('.').pop().toLowerCase();
        
        switch (fileType) {
            case 'pdf':
                resumeText = await extractTextFromPDF(file);
                break;
            case 'docx':
                resumeText = await extractTextFromDOCX(file);
                break;
            case 'doc':
                alert('DOC format may not parse correctly. Consider converting to DOCX for better results.');
                resumeText = await extractTextFromDOCX(file);
                break;
            case 'txt':
                resumeText = await extractTextFromTXT(file);
                break;
            default:
                alert('Unsupported file format. Please upload a PDF, DOCX, or TXT file.');
                removeFile();
                return;
        }
        
        if (resumeText && resumeText.length > 50) {
            startInterviewBtn.disabled = false;
        } else {
            alert('Could not extract sufficient text from the resume. Please try a different file.');
            removeFile();
        }
    } catch (error) {
        console.error('Error processing file:', error);
        alert('Error processing file. Please try again with a different file.');
        removeFile();
    }
}

// Extract text from PDF using PDF.js
async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
            try {
                const typedArray = new Uint8Array(this.result);
                const loadingTask = pdfjsLib.getDocument({data: typedArray});
                const pdf = await loadingTask.promise;
                
                let extractedText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    extractedText += pageText + '\n';
                }
                
                resolve(extractedText);
            } catch (error) {
                console.error('Error extracting text from PDF:', error);
                reject(error);
            }
        };
        
        fileReader.onerror = function() {
            reject(new Error('Error reading file'));
        };
        
        fileReader.readAsArrayBuffer(file);
    });
}

// Extract text from DOCX using Mammoth.js
async function extractTextFromDOCX(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const arrayBuffer = event.target.result;
            
            mammoth.extractRawText({arrayBuffer})
                .then(result => {
                    resolve(result.value);
                })
                .catch(error => {
                    console.error('Error extracting text from DOCX:', error);
                    reject(error);
                });
        };
        
        reader.onerror = function() {
            reject(new Error('Error reading file'));
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Extract text from TXT file
async function extractTextFromTXT(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            resolve(event.target.result);
        };
        
        reader.onerror = function() {
            reject(new Error('Error reading file'));
        };
        
        reader.readAsText(file);
    });
}

// Start the interview process
async function startInterview() {
    if (!resumeText) {
        alert('Please upload your resume first.');
        return;
    }
    
    if (!groqApiKey) {
        const key = prompt('Please enter your Groq API key:');
        if (!key) {
            alert('A Groq API key is required to continue.');
            return;
        }
        saveApiKey(key);
    }
    
    // Reset interview state
    currentQuestionIndex = 0;
    interviewQuestions = [];
    userAnswers = [];
    feedbackResponses = [];
    
    // Collect job details
    const jobTitle = document.getElementById('job-title')?.value || 'the position';
    const companyName = document.getElementById('company-name')?.value || 'the company';
    const jobDescription = document.getElementById('job-description')?.value || '';
    const experienceLevel = document.getElementById('experience-level')?.value || '';
    
    // Show interview section and hide upload section
    uploadSection.style.display = 'none';
    interviewSection.style.display = 'block';
    
    // Show loading indicator
    loadingIndicator.style.display = 'block';
    questionContainer.textContent = '';
    
    try {
        // Generate interview questions using Groq API
        await generateInterviewQuestions(resumeText, jobTitle, companyName, jobDescription, experienceLevel);
        
        // Load the first question
        loadCurrentQuestion();
    } catch (error) {
        console.error('Error starting interview:', error);
        alert('Error generating interview questions. Please try again.');
        // Go back to upload section
        uploadSection.style.display = 'block';
        interviewSection.style.display = 'none';
    }
}

// Generate interview questions using Groq API
async function generateInterviewQuestions(resume, jobTitle, companyName, jobDescription, experienceLevel) {
    try {
        const prompt = `
As an expert in recruitment and hiring, analyze the following resume and generate 10 tailored interview questions for a first-round technical interview for ${jobTitle} at ${companyName}.

Job Details:
- Position: ${jobTitle}
- Company: ${companyName}
- Experience Level: ${experienceLevel}
${jobDescription ? `- Job Description: ${jobDescription}` : ''}

Resume:
${resume}

Generate 10 questions that include:
- 3-4 behavioral questions based on past experiences mentioned in the resume
- 4-5 technical questions related to skills and technologies in the resume
- 1-2 situational questions relevant to the job role

Format your response as a JSON array of questions only. Example:
[
  "Question 1...",
  "Question 2...",
  "Question 3...",
  etc.
]
`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert AI assistant for technical interview preparation.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1024,
                temperature: 0.7,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);
        
        if (Array.isArray(content)) {
            interviewQuestions = content;
        } else if (content.questions && Array.isArray(content.questions)) {
            interviewQuestions = content.questions;
        } else {
            // Fallback in case the response format isn't as expected
            throw new Error('Invalid response format from API');
        }
        
        // Ensure we have at least some questions
        if (interviewQuestions.length === 0) {
            throw new Error('No questions were generated');
        }
        
        console.log('Generated questions:', interviewQuestions);
    } catch (error) {
        console.error('Error generating questions:', error);
        throw error;
    }
}

// Load current question
function loadCurrentQuestion() {
    // Hide feedback section and show user input section
    feedbackSection.style.display = 'none';
    document.getElementById('user-section').style.display = 'block';
    
    // Update question counter
    questionCounter.textContent = `Question ${currentQuestionIndex + 1}/${interviewQuestions.length}`;
    
    // Display current question
    questionContainer.textContent = interviewQuestions[currentQuestionIndex];
    
    // Clear previous answer
    answerInput.value = '';
    
    // Hide loading indicator
    loadingIndicator.style.display = 'none';
    
    // Focus on answer input
    answerInput.focus();
}

// Submit current answer
async function submitAnswer() {
    const answer = answerInput.value.trim();
    
    if (!answer) {
        alert('Please provide an answer or skip this question.');
        return;
    }
    
    // Save user's answer
    userAnswers[currentQuestionIndex] = answer;
    
    // Show loading in feedback section
    feedbackSection.style.display = 'block';
    feedbackContainer.innerHTML = `
        <div class="d-flex justify-content-center my-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <span class="ms-3">Analyzing your answer...</span>
        </div>
    `;
    
    // Hide user input section
    document.getElementById('user-section').style.display = 'none';
    
    try {
        // Generate feedback using Groq API
        const feedback = await generateFeedback(interviewQuestions[currentQuestionIndex], answer);
        feedbackResponses[currentQuestionIndex] = feedback;
        
        // Display feedback
        displayFeedback(feedback);
    } catch (error) {
        console.error('Error generating feedback:', error);
        feedbackContainer.innerHTML = `
            <div class="alert alert-danger">
                Error generating feedback. Please try again or proceed to the next question.
            </div>
        `;
    }
}

// Generate feedback using Groq API
async function generateFeedback(question, answer) {
    try {
        const prompt = `
You are an expert technical interviewer. Analyze the following interview question and the candidate's answer.

Question: "${question}"

Candidate's answer: "${answer}"

Provide constructive feedback on the answer, including:
1. Strengths: What aspects of the answer were good?
2. Areas for improvement: What could have been better?
3. Suggested response: A brief example of a strong answer to this question.

Format your response as a JSON object with these three sections. Example:
{
  "strengths": "Your answer effectively demonstrated...",
  "improvements": "You could improve by...",
  "suggestion": "A strong answer would be..."
}
`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert AI assistant for technical interview preparation.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1024,
                temperature: 0.5,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error('Error generating feedback:', error);
        throw error;
    }
}

// Display feedback
function displayFeedback(feedback) {
    let feedbackHTML = '';
    
    if (feedback.strengths) {
        feedbackHTML += `
            <div class="feedback-item feedback-strength mb-3">
                <h5>Strengths</h5>
                <p>${feedback.strengths}</p>
            </div>
        `;
    }
    
    if (feedback.improvements) {
        feedbackHTML += `
            <div class="feedback-item feedback-improvement mb-3">
                <h5>Areas for Improvement</h5>
                <p>${feedback.improvements}</p>
            </div>
        `;
    }
    
    if (feedback.suggestion) {
        feedbackHTML += `
            <div class="feedback-item feedback-suggestion">
                <h5>Suggested Response</h5>
                <p>${feedback.suggestion}</p>
            </div>
        `;
    }
    
    feedbackContainer.innerHTML = feedbackHTML;
}

// Skip current question
function skipQuestion() {
    // Mark as skipped
    userAnswers[currentQuestionIndex] = "[SKIPPED]";
    
    // Move to next question
    loadNextQuestion();
}

// Load next question
function loadNextQuestion() {
    currentQuestionIndex++;
    
    if (currentQuestionIndex < interviewQuestions.length) {
        loadCurrentQuestion();
    } else {
        completeInterview();
    }
}

// Complete the interview and show summary
async function completeInterview() {
    document.getElementById('interview-container').style.display = 'none';
    loadingIndicator.style.display = 'block';
    
    try {
        // Generate performance summary using Groq API
        const summary = await generateSummary();
        
        // Display performance summary
        displayPerformanceSummary(summary);
        
        // Show interview complete section
        interviewComplete.style.display = 'block';
    } catch (error) {
        console.error('Error generating summary:', error);
        interviewComplete.innerHTML = `
            <div class="alert alert-danger">
                Error generating interview summary. Please refresh the page to try again.
            </div>
        `;
        interviewComplete.style.display = 'block';
    }
    
    loadingIndicator.style.display = 'none';
}

// Generate performance summary using Groq API
async function generateSummary() {
    try {
        // Prepare data for summary generation
        const interviewData = [];
        for (let i = 0; i < interviewQuestions.length; i++) {
            interviewData.push({
                question: interviewQuestions[i],
                answer: userAnswers[i] || "[NO ANSWER PROVIDED]",
                feedback: feedbackResponses[i] || null
            });
        }
        
        const prompt = `
You are an expert interviewer. Review the following interview data and provide a comprehensive summary of the candidate's performance.

Interview Data:
${JSON.stringify(interviewData)}

Provide a performance summary including:
1. Overall assessment: A brief overview of the candidate's performance
2. Key strengths: 2-3 main strengths demonstrated
3. Areas for improvement: 2-3 main areas where the candidate could improve
4. Communication score: A score from 1-10 on communication clarity and effectiveness
5. Technical knowledge score: A score from 1-10 on technical expertise demonstrated
6. Next steps: Recommendations for how the candidate can improve for future interviews

Format your response as a JSON object. Example:
{
  "overallAssessment": "The candidate demonstrated...",
  "keyStrengths": ["Strength 1", "Strength 2"],
  "areasForImprovement": ["Area 1", "Area 2"],
  "communicationScore": 8,
  "technicalScore": 7,
  "nextSteps": "To prepare for future interviews..."
}
`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert AI assistant for technical interview preparation.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1024,
                temperature: 0.5,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error('Error generating summary:', error);
        throw error;
    }
}

// Display performance summary
function displayPerformanceSummary(summary) {
    let summaryHTML = '';
    
    if (summary.overallAssessment) {
        summaryHTML += `
            <div class="card mb-4">
                <div class="card-header bg-primary text-white">
                    Overall Assessment
                </div>
                <div class="card-body">
                    <p>${summary.overallAssessment}</p>
                </div>
            </div>
        `;
    }
    
    // Performance metrics
    summaryHTML += `
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header">Communication Skills</div>
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-2">
                            <span>Score:</span>
                            <span class="fw-bold">${summary.communicationScore}/10</span>
                        </div>
                        <div class="progress mb-3">
                            <div class="progress-bar" role="progressbar" style="width: ${summary.communicationScore * 10}%"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header">Technical Knowledge</div>
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-2">
                            <span>Score:</span>
                            <span class="fw-bold">${summary.technicalScore}/10</span>
                        </div>
                        <div class="progress mb-3">
                            <div class="progress-bar" role="progressbar" style="width: ${summary.technicalScore * 10}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Strengths and areas for improvement
    summaryHTML += `
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header bg-success text-white">Key Strengths</div>
                    <div class="card-body">
                        <ul class="list-group list-group-flush">
                            ${summary.keyStrengths.map(strength => `<li class="list-group-item">${strength}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header bg-warning text-dark">Areas for Improvement</div>
                    <div class="card-body">
                        <ul class="list-group list-group-flush">
                            ${summary.areasForImprovement.map(area => `<li class="list-group-item">${area}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Next steps
    if (summary.nextSteps) {
        summaryHTML += `
            <div class="card">
                <div class="card-header bg-info text-white">Next Steps</div>
                <div class="card-body">
                    <p>${summary.nextSteps}</p>
                </div>
            </div>
        `;
    }
    
    performanceSummary.innerHTML = summaryHTML;
}

// Restart interview
function restartInterview() {
    // Reset everything and go back to upload section
    resumeText = '';
    currentQuestionIndex = 0;
    interviewQuestions = [];
    userAnswers = [];
    feedbackResponses = [];
    
    // Show upload section and hide interview section
    uploadSection.style.display = 'block';
    interviewSection.style.display = 'none';
    interviewComplete.style.display = 'none';
    document.getElementById('interview-container').style.display = 'block';
    
    // Reset file upload
    removeFile();
}

// Download interview summary as PDF (placeholder - would need PDF library)
function downloadSummary() {
    alert('This feature would download a PDF summary of your interview results. For now, you can copy/paste the summary from the screen.');
    // In a real implementation, you would use a library like jsPDF to generate a PDF
}

// Initialize the environment variables from window
window.initEnvironment = function(env) {
    window.ENV = env;
    if (env && env.GROQ_API_KEY) {
        groqApiKey = env.GROQ_API_KEY;
    }
};