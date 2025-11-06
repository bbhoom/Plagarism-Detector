import requests

response = requests.post(
    'http://127.0.0.1:8000/api/hello-world/',
    json={'text': 'Machine learning is a subset of artificial intelligence'}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")