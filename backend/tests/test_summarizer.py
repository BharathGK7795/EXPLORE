import unittest
from backend.summarizer import split_into_sentences, tokenize_words, summarize_text

class TestSummarizer(unittest.TestCase):
    def test_split_into_sentences(self):
        text = "This is a sentence. This is another sentence! What about this? e.g. it is not split here. 3.14 is a decimal number."
        sentences = split_into_sentences(text)
        self.assertEqual(len(sentences), 5)
        self.assertEqual(sentences[0], "This is a sentence.")
        self.assertEqual(sentences[1], "This is another sentence!")
        self.assertEqual(sentences[2], "What about this?")
        self.assertEqual(sentences[3], "e.g. it is not split here.")
        self.assertEqual(sentences[4], "3.14 is a decimal number.")

    def test_tokenize_words(self):
        text = "Hello! World, 123 python."
        tokens = tokenize_words(text)
        self.assertEqual(tokens, ["hello", "world", "python"])

    def test_summarize_text_short(self):
        text = "This is short. Only two sentences."
        summary, keywords = summarize_text(text, num_sentences=3)
        self.assertEqual(summary, text)
        self.assertIn("sentences", keywords)

    def test_summarize_text_long(self):
        # A text of 4 sentences with clear repeated words
        text = (
            "Python is a great programming language. "
            "Many developers use python to write robust backend systems. "
            "Physics and coding are both great subjects. "
            "A completely unrelated sentence about something else entirely."
        )
        summary, keywords = summarize_text(text, num_sentences=2)
        # Check that we got 2 sentences in the summary
        sentences = split_into_sentences(summary)
        self.assertEqual(len(sentences), 2)
        # Python should be a key word
        self.assertIn("python", keywords)

if __name__ == "__main__":
    unittest.main()
