<?php

namespace LingoDotDev\PhpSdk\Tests;

use PHPUnit\Framework\TestCase;
use LingoDotDev\PhpSdk\LingoDotDevEngine;
use GuzzleHttp\Client as HttpClient;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Exception\RequestException;
use InvalidArgumentException;
use RuntimeException;
use ReflectionMethod; // To test private methods

class LingoDotDevEngineTest extends TestCase
{
    private string $apiKey = "test-api-key";
    private string $apiUrl = "http://test.local";

    public function testConstructorValidConfig()
    {
        $engine = new LingoDotDevEngine(["apiKey" => $this->apiKey]);
        $this->assertInstanceOf(LingoDotDevEngine::class, $engine);
    }

    public function testConstructorMissingApiKey()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("Missing or invalid apiKey in configuration.");
        new LingoDotDevEngine([]);
    }

    public function testConstructorInvalidApiKey()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("Missing or invalid apiKey in configuration.");
        new LingoDotDevEngine(["apiKey" => 123]);
    }

    public function testConstructorInvalidApiUrl()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("Invalid apiUrl in configuration.");
        new LingoDotDevEngine(["apiKey" => $this->apiKey, "apiUrl" => "invalid-url"]);
    }

    public function testConstructorInvalidBatchSize()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("Invalid batchSize in configuration (must be int 1-250).");
        new LingoDotDevEngine(["apiKey" => $this->apiKey, "batchSize" => 0]);
    }

    public function testConstructorInvalidIdealBatchItemSize()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("Invalid idealBatchItemSize in configuration (must be int 1-2500).");
        new LingoDotDevEngine(["apiKey" => $this->apiKey, "idealBatchItemSize" => 3000]);
    }

    // Helper method to create a mock engine
    private function createMockEngine(array $responses): LingoDotDevEngine
    {
        $mock = new MockHandler($responses);
        $handlerStack = HandlerStack::create($mock);
        // Use reflection to set the protected httpClient property
        $engine = new LingoDotDevEngine(["apiKey" => $this->apiKey, "apiUrl" => $this->apiUrl]);
        $reflection = new \ReflectionClass($engine);
        $property = $reflection->getProperty("httpClient");
        $property->setAccessible(true);
        $mockHttpClient = new HttpClient(["handler" => $handlerStack, "base_uri" => $this->apiUrl]);
        $property->setValue($engine, $mockHttpClient);
        return $engine;
    }

    // Test private method countWordsInRecord using reflection
    public function testCountWordsInRecord()
    {
        $engine = new LingoDotDevEngine(["apiKey" => $this->apiKey]);
        $method = new ReflectionMethod(LingoDotDevEngine::class, "countWordsInRecord");
        $method->setAccessible(true);

        $this->assertEquals(0, $method->invoke($engine, ""));
        $this->assertEquals(1, $method->invoke($engine, "word"));
        $this->assertEquals(3, $method->invoke($engine, "three words here"));
        $this->assertEquals(3, $method->invoke($engine, "  three   words   here  "));
        $this->assertEquals(5, $method->invoke($engine, ["one", "two", "three four five"]));
        $this->assertEquals(6, $method->invoke($engine, ["a" => "one two", "b" => ["three", "four five six"]]));
        $this->assertEquals(3, $method->invoke($engine, "it's a word")); // Apostrophe handling - 'it's' is one word
        $this->assertEquals(3, $method->invoke($engine, "你好 世界 hello")); // Unicode handling
    }

    // Helper method test (using reflection to access private method)
    public function testExtractPayload()
    {
        $engine = new LingoDotDevEngine(["apiKey" => $this->apiKey]);
        $method = new ReflectionMethod(LingoDotDevEngine::class, "extractPayload");
        $method->setAccessible(true);

        $payload = [
            "greeting" => "Hello",
            "details" => [
                "message" => "Welcome",
                "count" => 10,
                "items" => ["one", "two"]
            ],
            "enabled" => true
        ];

        $expected = [
            "greeting" => "Hello",
            "details.message" => "Welcome",
            "details.items[0]" => "one",
            "details.items[1]" => "two"
        ];

        $this->assertEquals($expected, $method->invoke($engine, $payload));
        $this->assertEquals(["root_string" => "Just a string"], $method->invoke($engine, "Just a string"));
    }

    // Helper method test (using reflection to access private method)
    public function testChunkPayload()
    {
        $engine = new LingoDotDevEngine(["apiKey" => $this->apiKey, "batchSize" => 3, "idealBatchItemSize" => 5]);
        $method = new ReflectionMethod(LingoDotDevEngine::class, "chunkPayload");
        $method->setAccessible(true);

        $payload = [
            "key1" => "one two",
            "key2" => "three four",
            "key3" => "five six seven", // Exceeds ideal size
            "key4" => "eight",
            "key5" => "nine ten eleven twelve thirteen fourteen", // Exceeds ideal size
            "key6" => "fifteen"
        ];

        $expected = [
            ["key1" => "one two", "key2" => "three four"], // Chunk 1 (size 4, count 2)
            ["key3" => "five six seven", "key4" => "eight"], // Chunk 2 (size 4, count 2)
            ["key5" => "nine ten eleven twelve thirteen fourteen"], // Chunk 3 (size 6, count 1)
            ["key6" => "fifteen"] // Chunk 4 (size 1, count 1)
        ];

        $this->assertEquals($expected, $method->invoke($engine, $payload));
    }

    // Helper method test (using reflection to access private method)
    public function testReconstructPayload()
    {
        $engine = new LingoDotDevEngine(["apiKey" => $this->apiKey]);
        $method = new ReflectionMethod(LingoDotDevEngine::class, "reconstructPayload");
        $method->setAccessible(true);

        $original = [
            "greeting" => "Hello",
            "details" => [
                "message" => "Welcome",
                "count" => 10,
                "items" => ["one", "two"]
            ]
        ];
        $localizedData = [
            "greeting" => "Bonjour",
            "details.message" => "Bienvenue",
            "details.items[0]" => "un",
            "details.items[1]" => "deux"
        ];
        $expected = [
            "greeting" => "Bonjour",
            "details" => [
                "message" => "Bienvenue",
                "count" => 10,
                "items" => ["un", "deux"]
            ]
        ];

        $this->assertEquals($expected, $method->invoke($engine, $original, $localizedData));
        $this->assertEquals("Bonjour", $method->invoke($engine, "Hello", ["root_string" => "Bonjour"]));
    }

    public function testLocalizeTextSuccess()
    {
        $engine = $this->createMockEngine([
            new Response(200, [], json_encode(["payload" => ["text" => "Bonjour"]]))
        ]);
        $result = $engine->localizeText("Hello", ["targetLocale" => "fr"]);
        $this->assertEquals("Bonjour", $result);
    }

    public function testLocalizeTextApiError()
    {
        $engine = $this->createMockEngine([
            new Response(500, [], "Internal Server Error")
        ]);
        $this->expectException(RuntimeException::class);
        // Check that the message contains the status and body
        $this->expectExceptionMessageMatches("/Status 500: Internal Server Error/");
        $engine->localizeText("Hello", ["targetLocale" => "fr"]);
    }

    public function testLocalizeTextApiErrorJson()
    {
        $engine = $this->createMockEngine([
            new Response(400, ["Content-Type" => "application/json"], json_encode(["error" => "Invalid locale"])) 
        ]);
        $this->expectException(RuntimeException::class);
        // Check that the message contains the status and the specific error from JSON
        $this->expectExceptionMessageMatches("/Status 400: Invalid locale/");
        $engine->localizeText("Hello", ["targetLocale" => "invalid"]);
    }

    public function testLocalizeTextNetworkError()
    {
        $engine = $this->createMockEngine([
            new RequestException("Network error", new Request("POST", "/i18n"))
        ]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches("/Network error/");
        $engine->localizeText("Hello", ["targetLocale" => "fr"]);
    }

    public function testLocalizeObjectSuccess()
    {
        $engine = $this->createMockEngine([
            new Response(200, [], json_encode(["payload" => ["greeting" => "Bonjour", "farewell" => "Au revoir"]]))
        ]);
        $data = ["greeting" => "Hello", "farewell" => "Goodbye"];
        $result = $engine->localizeObject($data, ["targetLocale" => "fr"]);
        $expected = ["greeting" => "Bonjour", "farewell" => "Au revoir"];
        $this->assertEquals($expected, $result);
    }

    public function testLocalizeObjectWithProgress()
    {
        // Use config that forces chunking for the test data
        $engine = new LingoDotDevEngine(["apiKey" => $this->apiKey, "apiUrl" => $this->apiUrl, "batchSize" => 1, "idealBatchItemSize" => 1]);
        $mock = new MockHandler([
            new Response(200, [], json_encode(["payload" => ["chunk1" => "Bonjour"]])), // Response for chunk 1
            new Response(200, [], json_encode(["payload" => ["chunk2" => "Monde"]]))  // Response for chunk 2
        ]);
        $handlerStack = HandlerStack::create($mock);
        $reflection = new \ReflectionClass($engine);
        $property = $reflection->getProperty("httpClient");
        $property->setAccessible(true);
        $mockHttpClient = new HttpClient(["handler" => $handlerStack, "base_uri" => $this->apiUrl]);
        $property->setValue($engine, $mockHttpClient);

        $data = ["chunk1" => "Hello", "chunk2" => "World"]; // Each item is 1 word, batchSize=1 forces split
        $progressUpdates = [];
        $result = $engine->localizeObject($data, ["targetLocale" => "fr"], function ($progress) use (&$progressUpdates) {
            $progressUpdates[] = $progress;
        });
        $expected = ["chunk1" => "Bonjour", "chunk2" => "Monde"];
        $this->assertEquals($expected, $result);
        $this->assertEquals([50, 100], $progressUpdates); // Expect 50% after chunk 1, 100% after chunk 2
    }
    public function testRecognizeLocaleSuccess()
    {
        $engine = $this->createMockEngine([
            new Response(200, [], json_encode(["locale" => "fr"])) 
        ]);
        $result = $engine->recognizeLocale("Bonjour");
        $this->assertEquals("fr", $result);
    }

    public function testRecognizeLocaleApiError()
    {
        $engine = $this->createMockEngine([
            new Response(500, [], "Server Error")
        ]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches("/Locale recognition failed: Status 500: Server Error/");
        $engine->recognizeLocale("Bonjour");
    }
}

