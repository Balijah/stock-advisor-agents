import os
from openai import OpenAI

# Set your API key from the environment variable
# If not set in environment, replace os.getenv() with your key
api_key = os.getenv("XAI_API_KEY") 

# Create a client, specifying the xAI base URL
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1" # This is the crucial part for xAI API
)

# Make a request using a Grok model (e.g., "grok-4-fast-reasoning")
try:
    response = client.chat.completions.create(
        model="grok-4-fast-reasoning",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Tell me a joke about programmers."}
        ],
        max_tokens=500
    )

    # Print the model's response
    print(response.choices[0].message.content)

except Exception as e:
    print(f"An error occurred: {e}")

