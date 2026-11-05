import unittest
import math
from backend.recommendation import calculate_cosine_similarity

class TestRecommendations(unittest.TestCase):
    def test_exact_match(self):
        user_vector = {"ai": 3}
        item_tags = ["ai"]
        similarity = calculate_cosine_similarity(user_vector, item_tags)
        self.assertAlmostEqual(similarity, 1.0)

    def test_zero_overlap(self):
        user_vector = {"ai": 3}
        item_tags = ["physics"]
        similarity = calculate_cosine_similarity(user_vector, item_tags)
        self.assertEqual(similarity, 0.0)

    def test_partial_overlap(self):
        # User vector: {"ai": 2, "physics": 1}
        # Item vector tags: ["ai"]
        # U = (2, 1) -> mag = sqrt(5)
        # V = (1, 0) -> mag = 1
        # Dot = 2
        # Cosine = 2 / sqrt(5) = 0.894427
        user_vector = {"ai": 2, "physics": 1}
        item_tags = ["ai"]
        similarity = calculate_cosine_similarity(user_vector, item_tags)
        expected = 2 / math.sqrt(5)
        self.assertAlmostEqual(similarity, expected, places=5)

    def test_empty_vectors(self):
        self.assertEqual(calculate_cosine_similarity({}, ["ai"]), 0.0)
        self.assertEqual(calculate_cosine_similarity({"ai": 2}, []), 0.0)

if __name__ == "__main__":
    unittest.main()
