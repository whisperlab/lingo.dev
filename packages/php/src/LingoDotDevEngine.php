<?php

namespace LingoDotDev\PhpSdk;

use Visus\Cuid2\Cuid2;
use GuzzleHttp\Client as HttpClient;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Utils;
// Removed: use Symfony\Component\DomCrawler\Crawler;
use InvalidArgumentException;
use RuntimeException;
use Throwable; // Import Throwable for broader exception catching in batch

class LingoDotDevEngine
{
    protected array $config;
    protected HttpClient $httpClient;

    /**
     * Default configuration values.
     */
    private const DEFAULTS = [
        "apiUrl" => "https://engine.lingo.dev",
        "batchSize" => 25,
        "idealBatchItemSize" => 250,
    ];

    // Removed LOCALIZABLE_ATTRIBUTES and UNLOCALIZABLE_TAGS constants

    /**
     * Create a new LingoDotDevEngine instance.
     *
     * @param array $config Configuration options for the Engine.
     *                      Required: "apiKey" (string)
     *                      Optional: "apiUrl" (string, default: "https://engine.lingo.dev"),
     *                                "batchSize" (int, default: 25, max: 250),
     *                                "idealBatchItemSize" (int, default: 250, max: 2500)
     * @throws InvalidArgumentException If required config is missing or invalid.
     */
    public function __construct(array $config)
    {
        if (empty($config["apiKey"]) || !is_string($config["apiKey"])) {
            throw new InvalidArgumentException("Missing or invalid apiKey in configuration.");
        }

        $this->config = array_merge(self::DEFAULTS, $config);

        // Basic validation for optional parameters
        if (!filter_var($this->config["apiUrl"], FILTER_VALIDATE_URL)) {
            throw new InvalidArgumentException("Invalid apiUrl in configuration.");
        }
        if (!is_int($this->config["batchSize"]) || $this->config["batchSize"] <= 0 || $this->config["batchSize"] > 250) {
            throw new InvalidArgumentException("Invalid batchSize in configuration (must be int 1-250).");
        }
        if (!is_int($this->config["idealBatchItemSize"]) || $this->config["idealBatchItemSize"] <= 0 || $this->config["idealBatchItemSize"] > 2500) {
            throw new InvalidArgumentException("Invalid idealBatchItemSize in configuration (must be int 1-2500).");
        }

        $this->httpClient = new HttpClient(["timeout" => 60.0]); // Add a default timeout
    }

    /**
     * Localize a typical PHP associative array (object equivalent).
     *
     * @param array $obj The array to be localized (string values will be extracted and translated).
     * @param array $params Localization parameters:
     *                      Required: "targetLocale" (string)
     *                      Optional: "sourceLocale" (string|null), "fast" (bool), "reference" (array)
     * @param callable|null $progressCallback Optional callback function to report progress (0-100).
     *                                        Receives: int $progress, array $sourceChunk, array $processedChunk
     * @return array A new array with the same structure but localized string values.
     * @throws RuntimeException If API request fails.
     * @throws InvalidArgumentException If parameters are invalid.
     */
    public function localizeObject(array $obj, array $params, ?callable $progressCallback = null): array
    {
        // In PHP, objects often map to associative arrays. We assume the input is such an array.
        // The _localizeRaw method already handles associative arrays.
        return $this->_localizeRaw($obj, $params, $progressCallback);
    }

    /**
     * Localize a single text string.
     *
     * @param string $text The text string to be localized.
     * @param array $params Localization parameters:
     *                      Required: "targetLocale" (string)
     *                      Optional: "sourceLocale" (string|null), "fast" (bool), "reference" (array)
     * @param callable|null $progressCallback Optional callback function to report progress (0-100).
     *                                        Receives: int $progress (will likely only be 100 for single text)
     * @return string The localized text string.
     * @throws RuntimeException If API request fails.
     * @throws InvalidArgumentException If parameters are invalid.
     */
    public function localizeText(string $text, array $params, ?callable $progressCallback = null): string
    {
        // Wrap the single text string in an array for _localizeRaw
        $payload = ["text" => $text];

        // Adapt progress callback if provided
        $internalProgressCallback = null;
        if ($progressCallback) {
            $internalProgressCallback = function (int $progress, array $sourceChunk, array $processedChunk) use ($progressCallback) {
                // For single text, progress is typically 0 or 100
                call_user_func($progressCallback, $progress);
            };
        }

        $response = $this->_localizeRaw($payload, $params, $internalProgressCallback);
        return $response["text"] ?? ""; // Return the localized text or empty string if not found
    }

    /**
     * Localize a text string to multiple target locales.
     *
     * @param string $text The text string to be localized.
     * @param array $params Localization parameters:
     *                      Required: "targetLocales" (array of strings)
     *                      Optional: "sourceLocale" (string|null), "fast" (bool)
     * @return array An associative array where keys are target locales and values are localized strings.
     *               If a locale fails, its value might be null or an error message (TBD: decide on error handling).
     */
    public function batchLocalizeText(string $text, array $params): array
    {
        if (empty($params["targetLocales"]) || !is_array($params["targetLocales"])) {
            throw new InvalidArgumentException("Missing or invalid targetLocales parameter (must be an array of strings).");
        }

        $results = [];
        $sourceLocale = $params["sourceLocale"] ?? null;
        $fast = $params["fast"] ?? false;

        // Note: This performs sequential requests. For true parallelism, async libraries like Amp or ReactPHP would be needed.
        foreach ($params["targetLocales"] as $targetLocale) {
            if (!is_string($targetLocale)) {
                 // Skip invalid locales or throw an error?
                 $results[$targetLocale] = new InvalidArgumentException("Invalid target locale provided.");
                 continue;
            }
            try {
                $results[$targetLocale] = $this->localizeText($text, [
                    "sourceLocale" => $sourceLocale,
                    "targetLocale" => $targetLocale,
                    "fast" => $fast,
                ]);
            } catch (Throwable $e) {
                // Store the exception or a message for the failed locale
                $results[$targetLocale] = $e; // Or $e->getMessage();
            }
        }

        return $results;
    }

    /**
     * Localize a chat sequence while preserving speaker names.
     *
     * @param array $chat Array of chat messages, each an associative array with "name" and "text" keys.
     *                    Example: [["name" => "User1", "text" => "Hello"], ["name" => "User2", "text" => "Hi there"]]
     * @param array $params Localization parameters:
     *                      Required: "targetLocale" (string)
     *                      Optional: "sourceLocale" (string|null), "fast" (bool), "reference" (array)
     * @param callable|null $progressCallback Optional callback function to report progress (0-100).
     *                                        Receives: int $progress
     * @return array Array of localized chat messages with preserved structure.
     * @throws RuntimeException If API request fails.
     * @throws InvalidArgumentException If parameters or chat structure are invalid.
     */
    public function localizeChat(array $chat, array $params, ?callable $progressCallback = null): array
    {
        // Validate chat structure
        $payload = [];
        foreach ($chat as $index => $message) {
            if (!is_array($message) || !isset($message["name"]) || !isset($message["text"]) || !is_string($message["name"]) || !is_string($message["text"])) {
                throw new InvalidArgumentException("Invalid chat message structure at index {$index}.");
            }
            // Create keys that allow mapping back, similar to TS SDK"s approach
            $payload["chat_{$index}"] = $message["text"];
        }

        // Adapt progress callback if provided
        $internalProgressCallback = null;
        if ($progressCallback) {
            $internalProgressCallback = function (int $progress, array $sourceChunk, array $processedChunk) use ($progressCallback) {
                call_user_func($progressCallback, $progress);
            };
        }

        $localizedTexts = $this->_localizeRaw($payload, $params, $internalProgressCallback);

        // Reconstruct the chat array
        $resultChat = [];
        foreach ($chat as $index => $originalMessage) {
            $key = "chat_{$index}";
            $resultChat[] = [
                "name" => $originalMessage["name"],
                "text" => $localizedTexts[$key] ?? $originalMessage["text"], // Use original if localization failed?
            ];
        }

        return $resultChat;
    }

    // Removed localizeHtml method

    /**
     * Recognize the locale of a given text string.
     *
     * @param string $text The text string to analyze.
     * @return string The detected locale code (e.g., "en", "fr").
     * @throws RuntimeException If API request fails.
     */
    public function recognizeLocale(string $text): string
    {
        $workflowId = (new Cuid2())->__toString();
        $requestBody = json_encode([
            "workflowId" => $workflowId,
            "payload" => $text,
        ]);

        try {
            $response = $this->httpClient->post($this->config["apiUrl"] . "/recognize", [
                "headers" => [
                    "Authorization" => "Bearer " . $this->config["apiKey"],
                    "Content-Type" => "application/json",
                ],
                "body" => $requestBody,
            ]);

            $responseBody = json_decode((string) $response->getBody(), true);

            if ($response->getStatusCode() >= 400 || empty($responseBody["locale"])) {
                $errorMessage = $responseBody["error"] ?? "Unknown error during locale recognition";
                throw new RuntimeException("Locale recognition failed: {$errorMessage}");
            }

            return $responseBody["locale"];
        } catch (RequestException $e) {
            $errorMessage = $this->formatGuzzleError($e);
            throw new RuntimeException("Locale recognition failed: {$errorMessage}", 0, $e);
        } catch (Throwable $e) {
            throw new RuntimeException("Locale recognition failed: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Internal method to handle the core localization logic for various data types.
     *
     * @param mixed $payload The data to localize (string, array).
     * @param array $params Localization parameters.
     * @param callable|null $progressCallback Progress callback.
     * @return mixed Localized data in the same structure as the payload.
     */
    private function _localizeRaw(mixed $payload, array $params, ?callable $progressCallback = null): mixed
    {
        if (empty($params["targetLocale"]) || !is_string($params["targetLocale"])) {
            throw new InvalidArgumentException("Missing or invalid targetLocale parameter.");
        }

        $extracted = $this->extractPayload($payload);
        $chunks = $this->chunkPayload($extracted);
        $totalChunks = count($chunks);
        $processedChunks = [];
        $completedChunks = 0;

        foreach ($chunks as $index => $chunk) {
            $workflowId = (new Cuid2())->__toString();
            $requestBody = json_encode([
                "workflowId" => $workflowId,
                "payload" => $chunk,
                "sourceLocale" => $params["sourceLocale"] ?? null,
                "targetLocale" => $params["targetLocale"],
                "fast" => $params["fast"] ?? false,
                "reference" => $params["reference"] ?? null,
            ]);

            try {
                // Use the class"s httpClient property, not a new one
                $response = $this->httpClient->post($this->config["apiUrl"] . "/i18n", [
                    "headers" => [
                        "Authorization" => "Bearer " . $this->config["apiKey"],
                        "Content-Type" => "application/json",
                    ],
                    "body" => $requestBody,
                ]);

                $responseBody = json_decode((string) $response->getBody(), true);

                if ($response->getStatusCode() >= 400 || !isset($responseBody["payload"])) {
                    $errorMessage = $responseBody["error"] ?? "Unknown API error";
                    throw new RuntimeException("API request failed with status {$response->getStatusCode()}: {$errorMessage}");
                }

                $processedChunks[] = $responseBody["payload"];
                $completedChunks++;

                if ($progressCallback) {
                    $progress = $totalChunks > 0 ? (int) (($completedChunks / $totalChunks) * 100) : 100;
                    call_user_func($progressCallback, $progress, $chunk, $responseBody["payload"]);
                }
            } catch (RequestException $e) {
                $errorMessage = $this->formatGuzzleError($e);
                // Allow partial success? For now, fail the whole operation.
                throw new RuntimeException("Failed to localize chunk {$index}: API request failed: {$errorMessage}", 0, $e);
            } catch (Throwable $e) {
                throw new RuntimeException("Failed to localize chunk {$index}: " . $e->getMessage(), 0, $e);
            }
        }

        // Merge processed chunks back together
        $mergedPayload = array_merge(...$processedChunks);

        // Reconstruct the original payload structure
        return $this->reconstructPayload($payload, $mergedPayload);
    }

    /**
     * Extracts string values from a nested payload into a flat key-value array.
     * Keys represent the path to the original string.
     *
     * @param mixed $payload The input payload (string, array).
     * @param string $currentPath Internal use for recursion.
     * @param array $result Internal use for recursion.
     * @return array Flat array of [path => stringValue].
     */
    private function extractPayload(mixed $payload, string $currentPath = "", array &$result = []): array
    {
        if (is_array($payload)) {
            // Check if it"s a sequential array (list) or associative array (object)
            $isList = array_keys($payload) === range(0, count($payload) - 1);
            foreach ($payload as $key => $value) {
                $newPath = $currentPath ? ($isList ? $currentPath . "[" . $key . "]" : $currentPath . "." . $key) : (string)$key;
                $this->extractPayload($value, $newPath, $result);
            }
        } elseif (is_string($payload) && trim($payload) !== "") {
            // Use the path as the key, ensure it"s unique if the root is just a string
            $key = $currentPath ?: "root_string"; 
            $result[$key] = $payload;
        }
        // Ignore other types (numbers, booleans, null)
        return $result;
    }

    /**
     * Reconstructs the original payload structure using the localized flat data.
     *
     * @param mixed $originalPayload The original structure.
     * @param array $localizedData Flat array of [path => localizedString].
     * @param string $currentPath Internal use for recursion.
     * @return mixed Reconstructed payload with localized strings.
     */
    private function reconstructPayload(mixed $originalPayload, array $localizedData, string $currentPath = ""): mixed
    {
        if (is_array($originalPayload)) {
            $reconstructed = [];
            $isList = array_keys($originalPayload) === range(0, count($originalPayload) - 1);
            foreach ($originalPayload as $key => $value) {
                $newPath = $currentPath ? ($isList ? $currentPath . "[" . $key . "]" : $currentPath . "." . $key) : (string)$key;
                $reconstructed[$key] = $this->reconstructPayload($value, $localizedData, $newPath);
            }
            return $reconstructed;
        } elseif (is_string($originalPayload)) {
            $key = $currentPath ?: "root_string";
            // Return localized string if available, otherwise the original
            return $localizedData[$key] ?? $originalPayload;
        } else {
            // Return non-string types as is
            return $originalPayload;
        }
    }

    /**
     * Splits the flat payload into chunks based on configuration.
     *
     * @param array $payload Flat array [path => stringValue].
     * @return array Array of chunks, where each chunk is a [path => stringValue] array.
     */
    private function chunkPayload(array $payload): array
    {
        $result = [];
        $currentChunk = [];
        $currentChunkItemCount = 0;
        $currentChunkSize = 0;
        $i = 0;
        $totalEntries = count($payload);

        foreach ($payload as $key => $value) {
            $i++;
            $itemWordCount = $this->countWordsInRecord($value);

            // If the current chunk is empty and this item alone exceeds the ideal size, it forms its own chunk.
            if ($currentChunkItemCount === 0 && $itemWordCount > $this->config["idealBatchItemSize"]) {
                $result[] = [$key => $value];
                continue; // Move to the next item
            }

            // Check if adding this item would exceed limits
            $wouldExceedBatchSize = ($currentChunkItemCount + 1) > $this->config["batchSize"];
            $wouldExceedIdealSize = ($currentChunkSize + $itemWordCount) > $this->config["idealBatchItemSize"];

            // If the chunk is not empty and adding the current item would exceed limits, finalize the current chunk.
            if ($currentChunkItemCount > 0 && ($wouldExceedBatchSize || $wouldExceedIdealSize)) {
                $result[] = $currentChunk;
                $currentChunk = [];
                $currentChunkItemCount = 0;
                $currentChunkSize = 0;
            }

            // Add the current item to the chunk
            $currentChunk[$key] = $value;
            $currentChunkItemCount++;
            $currentChunkSize += $itemWordCount;

            // If this is the last item, finalize the current chunk
            if ($i === $totalEntries) {
                $result[] = $currentChunk;
            }
        }

        // Handle the case where the input payload was empty
        if (empty($result) && empty($payload)) {
            return [];
        }
        // If the loop finished but the last chunk wasn"t added (e.g., single item smaller than limit)
        // This check might be redundant due to the $i === $totalEntries check inside the loop
        // else if (!empty($currentChunk)) {
        //     $result[] = $currentChunk;
        // }

        return $result;
    }


    /**
     * Count words in a value (string, array, or object).
     *
     * @param mixed $payload The value to count words in.
     * @return int The total number of words.
     */
    private function countWordsInRecord(mixed $payload): int
    {
        if (is_string($payload)) {
            // Match words: sequences of Unicode letters, numbers. Apostrophes handled by allowing them within words.
            preg_match_all("/[\p{L}\p{N}\\'’]+/u", $payload, $matches);
            return count($matches[0]);
        } elseif (is_array($payload)) {
            $count = 0;
            foreach ($payload as $value) {
                $count += $this->countWordsInRecord($value);
            }
            return $count;
        }
        return 0;
    }

    /**
     * Formats a Guzzle RequestException into a readable error message.
     *
     * @param RequestException $e The exception instance.
     * @return string Formatted error message.
     */
    private function formatGuzzleError(RequestException $e): string
    {
        $message = $e->getMessage();
        if ($e->hasResponse()) {
            $response = $e->getResponse();
            $statusCode = $response->getStatusCode();
            $body = (string) $response->getBody();
            // Attempt to decode JSON body for more specific error
            $jsonBody = json_decode($body, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($jsonBody["error"])) {
                $message = "Status {$statusCode}: " . $jsonBody["error"];
            } else {
                // Fallback to status code and raw body if not JSON or no "error" key
                $message = "Status {$statusCode}: " . ($body ?: $response->getReasonPhrase());
            }
        }
        // Remove sensitive auth header from logged message if present
        $message = preg_replace("/Authorization: Bearer [^\s]+/", "Authorization: Bearer [REDACTED]", $message);
        return $message;
    }
}

