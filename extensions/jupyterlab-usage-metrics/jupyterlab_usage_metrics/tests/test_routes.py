import json


async def test_hello(jp_fetch):
    # When
    response = await jp_fetch("jupyterlab-usage-metrics", "hello")

    # Then
    assert response.code == 200
    payload = json.loads(response.body)
    assert payload == {
            "data": (
                "Hello, world!"
                " This is the '/jupyterlab-usage-metrics/hello' endpoint."
                " Try visiting me in your browser!"
            ),
        }
