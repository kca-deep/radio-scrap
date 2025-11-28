"""Test translation pipeline to debug content_ko issue."""
import asyncio
import json
import os
import sys

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, '.')

async def test_translation():
    from app.services.translator_service import process_translation, translate_content, extract_content

    # Sample content from the database
    test_content = """**Status:** Pending Statement (Closed)
**Closes:** 2025-09-30

## Description
We are consulting on authorising parts of Q/V band for use by GSO and NGSO gateway earth stations.

Services which rely on satellite connectivity are increasingly important for UK consumers and businesses.

## What we are proposing
- **GSO:** uplink 47.2 – 50.2 GHz, downlink 37.5 – 42.5 GHz
- **NGSO:** uplink 47.2 – 50.2 GHz, downlink 37.5 – 42.5 GHz
"""

    print("=" * 60)
    print("TEST 1: Full process_translation")
    print("=" * 60)

    try:
        result = await process_translation(test_content, "Ofcom")

        print("\n[Result Keys]:", list(result.keys()))
        print("\n[extracted keys]:", list(result.get('extracted', {}).keys()))
        print("\n[translated keys]:", list(result.get('translated', {}).keys()))

        print("\n[title]:", result.get('title', 'N/A')[:100])
        print("[title_ko]:", result.get('title_ko', 'N/A')[:100])
        print("[content length]:", len(result.get('content', '') or ''))
        print("[content_ko length]:", len(result.get('content_ko', '') or ''))

        if result.get('content_ko'):
            print("\n[content_ko preview]:", result['content_ko'][:500])
        else:
            print("\n[content_ko]: EMPTY OR NULL!")

        # Print the full translated dict
        print("\n[Full translated dict]:")
        print(json.dumps(result.get('translated', {}), ensure_ascii=False, indent=2)[:2000])

    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 60)
    print("TEST 2: Direct translate_content with minimal input")
    print("=" * 60)

    try:
        minimal_input = {
            "title": "Test Document",
            "content": "This is a test content about spectrum policy."
        }

        result = await translate_content(minimal_input)
        print("\n[Result]:")
        print(json.dumps(result, ensure_ascii=False, indent=2))

    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_translation())
