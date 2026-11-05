import math
from typing import Dict, List

def calculate_cosine_similarity(user_vector: Dict[str, int], item_tags: List[str]) -> float:
    if not user_vector or not item_tags:
        return 0.0

    # Dot product: sum of user_vector[tag] * item_vector[tag] (where item_vector[tag] is 1 for tags it has)
    dot_product = 0.0
    for tag in item_tags:
        dot_product += user_vector.get(tag, 0)

    if dot_product == 0.0:
        return 0.0

    # User vector magnitude: sqrt(sum(count^2))
    user_magnitude = math.sqrt(sum(count ** 2 for count in user_vector.values()))
    
    # Item vector magnitude: sqrt(sum(1^2)) = sqrt(number of tags)
    item_magnitude = math.sqrt(len(item_tags))

    if user_magnitude == 0.0 or item_magnitude == 0.0:
        return 0.0

    return dot_product / (user_magnitude * item_magnitude)
