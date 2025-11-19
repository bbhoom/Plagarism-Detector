import random
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import requests
from bs4 import BeautifulSoup
import json
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from ddgs import DDGS
import numpy as np
from io import BytesIO
import pdfplumber
import re
from transformers import GPT2LMHeadModel, GPT2Tokenizer
import torch

# Model for semantic similarity
model = None
def get_model():
    global model
    if model is None:
        model = SentenceTransformer('all-MiniLM-L6-v2')
    return model

class AIContentDetector:
    def __init__(self):
        """Initialize models - GPT2 for perplexity, reuse your sentence transformer"""
        # ⚡ Load GPT-2 in lightweight (float16) mode and on CPU
        self.perplexity_model = GPT2LMHeadModel.from_pretrained(
            'gpt2', dtype=torch.float16).to('cpu')
        self.perplexity_tokenizer = GPT2Tokenizer.from_pretrained('gpt2')
        # ⚡ Load a small sentence transformer model for faster startup
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

        self.perplexity_model.eval()
        
    def calculate_perplexity(self, text, max_length=512):
        """
        Calculate perplexity - AI text has LOWER perplexity (more predictable)
        Human text has HIGHER perplexity (more creative/varied)
        """
        try:
            # Tokenize
            encodings = self.perplexity_tokenizer(
                text, 
                return_tensors='pt',
                truncation=True,
                max_length=max_length
            )
            
            input_ids = encodings.input_ids
            
            with torch.no_grad():
                outputs = self.perplexity_model(input_ids, labels=input_ids)
                loss = outputs.loss
            
            perplexity = torch.exp(loss).item()
            return perplexity
            
        except Exception as e:
            print(f"Perplexity calculation error: {e}")
            return None
    
    def calculate_burstiness(self, text):
        """
        Measure sentence length variation
        Human: HIGH burstiness (varied sentences)
        AI: LOW burstiness (uniform sentences)
        """
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if len(sentences) < 3:
            return 0
        
        lengths = [len(s.split()) for s in sentences]
        
        mean_length = np.mean(lengths)
        std_length = np.std(lengths)
        
        # Burstiness score
        burstiness = std_length / max(mean_length, 1)
        
        return burstiness
    
    def analyze_statistical_features(self, text):
        """
        Analyze writing patterns that differ between AI and humans
        """
        words = text.split()
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if not words or not sentences:
            return {}
        
        # Calculate metrics
        avg_sentence_length = len(words) / len(sentences)
        word_lengths = [len(w) for w in words]
        avg_word_length = np.mean(word_lengths)
        
        # Vocabulary diversity (Type-Token Ratio)
        unique_words = len(set([w.lower() for w in words]))
        ttr = unique_words / len(words)
        
        # Sentence length variance
        sentence_lengths = [len(s.split()) for s in sentences]
        sentence_variance = np.var(sentence_lengths)
        
        return {
            'avg_sentence_length': round(avg_sentence_length, 2),
            'avg_word_length': round(avg_word_length, 2),
            'vocabulary_diversity': round(ttr, 3),
            'sentence_variance': round(sentence_variance, 2),
            'total_sentences': len(sentences),
            'total_words': len(words)
        }
    
    def detect_ai_content(self, text, detailed=False):
        """
        Main detection function - combines multiple signals
        Returns probability score (0-100) that text is AI-generated
        """
        if not text or len(text.split()) < 50:
            return {
                'error': 'Text too short for reliable detection (minimum 50 words)',
                'ai_probability': None
            }
        
        # 1. Calculate perplexity
        perplexity = self.calculate_perplexity(text)
        
        # 2. Calculate burstiness
        burstiness = self.calculate_burstiness(text)
        
        # 3. Get statistical features
        stats = self.analyze_statistical_features(text)
        
        # Scoring logic
        ai_score = 0
        confidence_factors = []
        
        # Perplexity scoring (weight: 40%)
        if perplexity:
            if perplexity < 30:
                perplexity_score = 40
                confidence_factors.append("Very low perplexity (highly predictable)")
            elif perplexity < 50:
                perplexity_score = 30
                confidence_factors.append("Low perplexity (somewhat predictable)")
            elif perplexity < 100:
                perplexity_score = 15
                confidence_factors.append("Moderate perplexity")
            else:
                perplexity_score = 0
                confidence_factors.append("High perplexity (varied language)")
            
            ai_score += perplexity_score
        
        # Burstiness scoring (weight: 30%)
        if burstiness < 0.3:
            burstiness_score = 30
            confidence_factors.append("Very uniform sentence lengths")
        elif burstiness < 0.5:
            burstiness_score = 20
            confidence_factors.append("Somewhat uniform sentences")
        elif burstiness < 0.7:
            burstiness_score = 10
            confidence_factors.append("Moderate sentence variation")
        else:
            burstiness_score = 0
            confidence_factors.append("High sentence variation (human-like)")
        
        ai_score += burstiness_score
        
        # Statistical features (weight: 30%)
        stat_score = 0
        
        # AI tends to have very consistent sentence length
        if 15 <= stats['avg_sentence_length'] <= 25:
            stat_score += 10
            confidence_factors.append("Optimal sentence length consistency")
        
        # AI has lower sentence variance
        if stats['sentence_variance'] < 30:
            stat_score += 10
            confidence_factors.append("Low sentence length variance")
        
        # AI often has higher vocabulary diversity
        if stats['vocabulary_diversity'] > 0.7:
            stat_score += 10
            confidence_factors.append("Very high vocabulary diversity")
        
        ai_score += stat_score
        
        # Determine verdict
        if ai_score >= 70:
            verdict = "Likely AI-Generated"
            confidence = "High"
        elif ai_score >= 50:
            verdict = "Possibly AI-Generated"
            confidence = "Medium"
        elif ai_score >= 30:
            verdict = "Possibly Human-Written"
            confidence = "Medium"
        else:
            verdict = "Likely Human-Written"
            confidence = "High"
        
        result = {
            'ai_probability': round(ai_score, 2),
            'verdict': verdict,
            'confidence': confidence,
            'perplexity': round(perplexity, 2) if perplexity else None,
            'burstiness': round(burstiness, 3),
        }
        
        if detailed:
            result['statistical_features'] = stats
            result['confidence_factors'] = confidence_factors
        
        return result

@csrf_exempt
def upload_pdf(request):
    """Extract text from uploaded PDF file using pdfplumber"""
    if request.method == 'POST':
        try:
            pdf_file = request.FILES.get('pdf')
            
            if not pdf_file:
                return JsonResponse({'error': 'No PDF file provided'}, status=400)
            
            # Read PDF with pdfplumber (better text extraction)
            text = ''
            with pdfplumber.open(BytesIO(pdf_file.read())) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + '\n\n'
            
            # Clean up the text formatting
            text = clean_pdf_text(text)
            
            if not text:
                return JsonResponse({'error': 'Could not extract text from PDF'}, status=400)
            
            return JsonResponse({
                'text': text,
                'page_count': len(pdf.pages)
            })
            
        except Exception as e:
            return JsonResponse({'error': f'Error processing PDF: {str(e)}'}, status=500)
    
    return JsonResponse({'error': 'Invalid request method'}, status=400)

@csrf_exempt
def hello_world(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        text = data.get('text', '')
        
        if not text:
            return JsonResponse({'error': 'No text provided'}, status=400)
        
        # Use first 100 words for search query
        search_query = ' '.join(text.split()[:100])
        
        # Search with DuckDuckGo (FAST!)
        search_results = duckduckgo_search(search_query, max_results=5)
        
        if not search_results:
            return JsonResponse({'error': 'No search results found'}, status=404)
        
        results = []
        max_similarity_score = 0
        top_link = None
        
        for result in search_results:
            # Scrape page content (NO SELENIUM!)
            page_content = scrape_page_fast(result['link'])
            
            if page_content:
                # Use semantic comparison (not TF-IDF!)
                similarity_score = compare_similarity_semantic(text, page_content)
                
                if similarity_score > max_similarity_score:
                    max_similarity_score = similarity_score
                    top_link = result['link']
                
                results.append({
                    'title': result['title'],
                    'link': result['link'],
                    'snippet': result['snippet'],
                    'similarity_score': similarity_score
                })
        
        return JsonResponse({
            'max_similarity_score': max_similarity_score,
            'top_link': top_link,
            'all_results': results
        })
    
    return JsonResponse({'error': 'Invalid request method'}, status=400)


def duckduckgo_search(query, max_results=5):
    """Fast DuckDuckGo search - no API key needed"""
    try:
        results = []
        with DDGS() as ddgs:
            for result in ddgs.text(query, max_results=max_results):
                results.append({
                    'title': result.get('title', ''),
                    'link': result.get('href', ''),
                    'snippet': result.get('body', '')
                })
        return results
    except Exception as e:
        print(f"Search error: {e}")
        return []


def scrape_page_fast(url, timeout=5):
    """Fast scraping with just requests + BeautifulSoup (no Selenium!)"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove unwanted elements
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            tag.decompose()
        
        # Get main content
        main_content = soup.find('main') or soup.find('article') or soup.find('body')
        
        if main_content:
            paragraphs = [p.get_text().strip() for p in main_content.find_all('p')]
            text = ' '.join(paragraphs)
            return text[:10000]  # Limit to 10k chars for speed
        
        return None
    except Exception as e:
        print(f"Scraping error for {url}: {e}")
        return None


def compare_similarity_semantic(text1, text2):
    """Compare similarity using AI embeddings (detects paraphrasing!)"""
    try:
        if not text1 or not text2:
            return 0.0
        
        # Clean texts
        text1 = clean_text(str(text1))
        text2 = clean_text(str(text2))
        
        # Get embeddings
        embeddings = get_model().encode([text1, text2])
        
        # Calculate cosine similarity
        similarity = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
        
        return round(float(similarity) * 100, 2)
    
    except Exception as e:
        print(f"Error comparing similarity: {e}")
        return 0.0


def clean_text(text):
    """Clean the text by removing unwanted characters and lowercasing."""
    return text.strip().lower()

def clean_pdf_text(text):
    """Clean up PDF text formatting issues"""
    if not text:
        return ''
    
    # Remove excessive whitespace and newlines
    text = re.sub(r'\n\s*\n+', '\n\n', text)
    
    # Fix words split across lines (hyphenation)
    text = re.sub(r'-\s*\n\s*', '', text)
    
    # Remove extra spaces
    text = re.sub(r' +', ' ', text)
    
    # Join lines that don't end with punctuation
    lines = text.split('\n')
    cleaned_lines = []
    current_paragraph = ''
    
    for line in lines:
        line = line.strip()
        
        if not line:
            if current_paragraph:
                cleaned_lines.append(current_paragraph)
                current_paragraph = ''
            continue
        
        if line[-1] in '.!?:':
            current_paragraph += ' ' + line if current_paragraph else line
            cleaned_lines.append(current_paragraph)
            current_paragraph = ''
        else:
            current_paragraph += ' ' + line if current_paragraph else line
    
    if current_paragraph:
        cleaned_lines.append(current_paragraph)
    
    text = '\n\n'.join(cleaned_lines)
    
    return text.strip()

# Initialize detector globally (lazy load)
_ai_detector = None
def get_ai_detector():
    global _ai_detector
    if _ai_detector is None:
        _ai_detector = AIContentDetector()
    return _ai_detector

@csrf_exempt
def detect_ai(request):
    """New endpoint for AI content detection"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            text = data.get('text', '')
            detailed = data.get('detailed', False)
            
            if not text:
                return JsonResponse({'error': 'No text provided'}, status=400)
            
            # Run AI detection
            result = get_ai_detector().detect_ai_content(text, detailed=detailed)

            
            return JsonResponse(result)
            
        except Exception as e:
            return JsonResponse({'error': f'Error detecting AI content: {str(e)}'}, status=500)
    
    return JsonResponse({'error': 'Invalid request method'}, status=400)


@csrf_exempt
def combined_check(request):
    """Combined plagiarism + AI detection endpoint"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            text = data.get('text', '')
            
            if not text:
                return JsonResponse({'error': 'No text provided'}, status=400)
            
            # 1. Check for AI content
            ai_result = get_ai_detector().detect_ai_content(text, detailed=True)

            
            # 2. Check for plagiarism (existing logic)
            search_query = ' '.join(text.split()[:100])
            search_results = duckduckgo_search(search_query, max_results=5)
            
            plagiarism_results = []
            max_similarity = 0
            top_match = None
            
            if search_results:
                for result in search_results:
                    page_content = scrape_page_fast(result['link'])
                    
                    if page_content:
                        similarity = compare_similarity_semantic(text, page_content)
                        
                        if similarity > max_similarity:
                            max_similarity = similarity
                            top_match = result['link']
                        
                        plagiarism_results.append({
                            'title': result['title'],
                            'link': result['link'],
                            'similarity_score': similarity
                        })
            
            # Combined verdict
            is_plagiarized = max_similarity > 70
            is_ai_generated = ai_result['ai_probability'] and ai_result['ai_probability'] > 50
            
            if is_plagiarized and is_ai_generated:
                overall_verdict = "AI-Generated and Plagiarized"
            elif is_plagiarized:
                overall_verdict = "Plagiarized"
            elif is_ai_generated:
                overall_verdict = "AI-Generated (Original)"
            else:
                overall_verdict = "Original Human Writing"
            
            return JsonResponse({
                'overall_verdict': overall_verdict,
                'ai_detection': ai_result,
                'plagiarism_detection': {
                    'max_similarity': max_similarity,
                    'top_match': top_match,
                    'all_matches': plagiarism_results
                }
            })
            
        except Exception as e:
            return JsonResponse({'error': f'Error in combined check: {str(e)}'}, status=500)
    
    return JsonResponse({'error': 'Invalid request method'}, status=400)
