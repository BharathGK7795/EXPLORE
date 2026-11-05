import re
import math
from typing import List, Tuple

# Common English stop words
STOP_WORDS = {
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can\'t', 'cannot', 'could',
    'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few', 'for',
    'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s',
    'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m',
    'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t',
    'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves',
    'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
    'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they',
    'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very',
    'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
    'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
    'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
}

def split_into_sentences(text: str) -> List[str]:
    # Splits on period, question mark, or exclamation mark followed by whitespace.
    # Excludes common abbreviations or decimal points.
    sentence_end = re.compile(r'(?<!\bMr\.)(?<!\bDr\.)(?<!\be\.g\.)(?<!\bi\.e\.)(?<=\.|\?|\!)\s')
    sentences = sentence_end.split(text.strip())
    return [s.strip() for s in sentences if s.strip()]

def tokenize_words(text: str) -> List[str]:
    # Extract lowercased alphabetic tokens
    words = re.findall(r'\b\w+\b', text.lower())
    return [w for w in words if w.isalpha()]

def summarize_text(text: str, num_sentences: int = 3) -> Tuple[str, List[str]]:
    sentences = split_into_sentences(text)
    if not sentences:
        return "", []
    
    if len(sentences) <= num_sentences:
        return text, get_key_words(text)
    
    sentence_tokens = [tokenize_words(s) for s in sentences]
    filtered_tokens = [[w for w in s if w not in STOP_WORDS] for s in sentence_tokens]
    
    # Calculate term frequencies within sentences
    tf_docs = []
    for s_tokens in filtered_tokens:
        tf = {}
        for w in s_tokens:
            tf[w] = tf.get(w, 0) + 1
        tf_docs.append(tf)
        
    # Calculate IDF across all sentences
    all_words = set()
    for s_tokens in filtered_tokens:
        all_words.update(s_tokens)
        
    idf = {}
    num_docs = len(sentences)
    for w in all_words:
        containing_docs = sum(1 for s_tokens in filtered_tokens if w in s_tokens)
        idf[w] = math.log((1 + num_docs) / (1 + containing_docs)) + 1
        
    # Score each sentence
    sentence_scores = []
    for idx, s_tokens in enumerate(filtered_tokens):
        if not s_tokens:
            sentence_scores.append((idx, 0.0))
            continue
        
        score = 0.0
        for w in s_tokens:
            tf = tf_docs[idx][w] / len(s_tokens)
            score += tf * idf[w]
        
        sentence_scores.append((idx, score))
        
    # Extract top index scores
    top_indices = sorted(sentence_scores, key=lambda x: x[1], reverse=True)[:num_sentences]
    top_indices = sorted([x[0] for x in top_indices])
    
    summary = " ".join([sentences[idx] for idx in top_indices])
    key_words = get_key_words_with_idf(filtered_tokens, idf)
    
    return summary, key_words

def get_key_words_with_idf(filtered_sentences: List[List[str]], idf: dict) -> List[str]:
    word_scores = {}
    for s_tokens in filtered_sentences:
        if not s_tokens:
            continue
        counts = {}
        for w in s_tokens:
            counts[w] = counts.get(w, 0) + 1
        for w, count in counts.items():
            tf = count / len(s_tokens)
            word_scores[w] = word_scores.get(w, 0.0) + (tf * idf[w])
            
    sorted_words = sorted(word_scores.items(), key=lambda x: x[1], reverse=True)
    return [w for w, score in sorted_words[:5]]

def get_key_words(text: str) -> List[str]:
    tokens = tokenize_words(text)
    filtered = [w for w in tokens if w not in STOP_WORDS]
    freq = {}
    for w in filtered:
        freq[w] = freq.get(w, 0) + 1
    sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [w for w, f in sorted_words[:5]]
