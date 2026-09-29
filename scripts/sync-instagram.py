import os
import json
import requests

ACCOUNTS = [
    {"user_id": os.getenv("IG_USER_ID_1"), "token": os.getenv("IG_TOKEN_1")},
    {"user_id": os.getenv("IG_USER_ID_2"), "token": os.getenv("IG_TOKEN_2")},
]

FEED_FILE = "data/instagram-feed.json"

def fetch_account_media(user_id, token):
    if not user_id or not token:
        return []
    url = f"https://graph.facebook.com/v21.0/{user_id}/media"
    params = {
        "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,like_count,comments_count,timestamp",
        "access_token": token,
        "limit": 15
    }
    try:
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        return res.json().get("data", [])
    except Exception as err:
        print(f"Error fetching account {user_id}: {err}")
        return []

def main():
    existing_feed = {"pinned_slots": {}, "posts": []}
    if os.path.exists(FEED_FILE):
        try:
            with open(FEED_FILE, "r") as f:
                existing_feed = json.load(f)
        except Exception:
            pass

    all_media = []
    for acc in ACCOUNTS:
        media = fetch_account_media(acc["user_id"], acc["token"])
        all_media.extend(media)

    # Calculate engagement metric
    processed_posts = []
    for item in all_media:
        likes = item.get("like_count", 0)
        comments = item.get("comments_count", 0)
        score = likes * 2 + comments * 5
        processed_posts.append({
            "id": item.get("id"),
            "permalink": item.get("permalink", "https://instagram.com/aviora.media"),
            "media_type": item.get("media_type"),
            "display_url": item.get("thumbnail_url") or item.get("media_url"),
            "caption": (item.get("caption") or "Aviora Media Production")[:65] + "...",
            "score": score
        })

    # Sort descending by performance score
    processed_posts.sort(key=lambda x: x["score"], reverse=True)

    # Hybrid Manual Slot Assignment
    # Check if slots 0 to 5 have pinned manual overrides
    pinned = existing_feed.get("pinned_slots", {})
    final_deck = []
    total_slots = 6

    for slot_idx in range(total_slots):
        slot_key = str(slot_idx)
        if slot_key in pinned and pinned[slot_key].get("permalink"):
            final_deck.append(pinned[slot_key])
        elif processed_posts:
            candidate = processed_posts.pop(0)
            final_deck.append(candidate)

    output = {
        "last_updated": requests.utils.default_user_agent(),
        "pinned_slots": pinned,
        "posts": final_deck
    }

    os.makedirs(os.path.dirname(FEED_FILE), exist_ok=True)
    with open(FEED_FILE, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Successfully generated {FEED_FILE} with {len(final_deck)} curated items.")

if __name__ == "__main__":
    main()
