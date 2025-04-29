# Lingo.dev PHP SDK

The official PHP SDK for the Lingo.dev API, enabling seamless localization of text, objects, HTML, and more.

This package is part of the [lingodotdev/lingo.dev](https://github.com/lingodotdev/lingo.dev) monorepo.

## Installation

Install the package via Composer:

```bash
composer require lingodotdev/php-sdk
```

## Basic Usage

```php
<?php

require_once __DIR__ . 
/vendor/autoload.php
; // Adjust path as needed

use LingoDotDev\PhpSdk\LingoDotDevEngine;

// Initialize the SDK with your API key
$engine = new LingoDotDevEngine([
    "apiKey" => "your-api-key-here"
]);

// Localize a simple text string
$localizedText = $engine->localizeText(
    "Hello, world!", 
    ["targetLocale" => "fr"]
);
echo $localizedText; // Outputs: "Bonjour, monde!"

// Localize an associative array (object)
$data = [
    "greeting" => "Welcome to our website",
    "message" => "Please sign in to continue",
    "buttons" => [
        "login" => "Sign In",
        "register" => "Create Account"
    ]
];

$localizedData = $engine->localizeObject(
    $data, 
    ["targetLocale" => "es"]
);

// Localize HTML content
$html = "<html><head><title>Welcome</title></head><body><h1>Hello</h1><p>Welcome to our site</p></body></html>";
$localizedHtml = $engine->localizeHtml(
    $html, 
    ["targetLocale" => "de"]
);
```

## Configuration Options

When initializing the SDK, you can provide several configuration options:

```php
$engine = new LingoDotDevEngine([
    "apiKey" => "your-api-key-here",     // Required
    "apiUrl" => "https://engine.lingo.dev", // Optional, default shown
    "batchSize" => 25,                   // Optional, default is 25, max 250
    "idealBatchItemSize" => 250          // Optional, default is 250, max 2500
]);
```

## API Methods

### Localize Text

```php
$localizedText = $engine->localizeText(
    "Hello, world!", 
    [
        "targetLocale" => "fr",      // Required
        "sourceLocale" => "en",      // Optional
        "fast" => false,             // Optional, default is false
        "reference" => [             // Optional
            "Hello, world!" => "Bonjour, monde!"
        ]
    ]
);
```

### Localize Object

```php
$localizedObject = $engine->localizeObject(
    $dataArray, 
    [
        "targetLocale" => "es",
        "sourceLocale" => "en",      // Optional
        "fast" => false              // Optional
    ],
    function ($progress, $sourceChunk, $processedChunk) {
        // Optional progress callback
        echo "Progress: $progress%\n";
    }
);
```

### Localize HTML

```php
$localizedHtml = $engine->localizeHtml(
    $htmlString, 
    [
        "targetLocale" => "de",
        "sourceLocale" => "en"       // Optional
    ],
    function ($progress) {
        // Optional progress callback
        echo "Progress: $progress%\n";
    }
);
```

### Batch Localize Text

```php
$results = $engine->batchLocalizeText(
    "Hello, world!", 
    [
        "targetLocales" => ["fr", "es", "de", "it"],
        "sourceLocale" => "en",      // Optional
        "fast" => false              // Optional
    ]
);

foreach ($results as $locale => $text) {
    echo "$locale: $text\n";
}
```

### Localize Chat

```php
$chat = [
    ["name" => "User", "text" => "Hello, how are you?"],
    ["name" => "Assistant", "text" => "I am doing well, thank you for asking!"]
];

$localizedChat = $engine->localizeChat(
    $chat, 
    ["targetLocale" => "fr"]
);
```

### Recognize Locale

```php
$detectedLocale = $engine->recognizeLocale("Bonjour, comment allez-vous?");
echo $detectedLocale; // Outputs: "fr"
```

## Error Handling

The SDK throws exceptions for various error conditions:

- `InvalidArgumentException`: For invalid configuration or parameters
- `RuntimeException`: For API request failures or processing errors

Example:

```php
try {
    $localizedText = $engine->localizeText("Hello", ["targetLocale" => "invalid-locale"]);
} catch (InvalidArgumentException $e) {
    echo "Invalid argument: " . $e->getMessage();
} catch (RuntimeException $e) {
    echo "API error: " . $e->getMessage();
} catch (Exception $e) {
    echo "General error: " . $e->getMessage();
}
```

## Advanced Usage

### Progress Tracking

For long-running operations, you can provide a callback function to track progress:

```php
$largeObject = [...]; // Large data structure

$localizedObject = $engine->localizeObject(
    $largeObject, 
    ["targetLocale" => "ja"],
    function ($progress, $sourceChunk, $processedChunk) {
        echo "Progress: $progress%\n";
        // You can also inspect the current chunk being processed
        // $sourceChunk is the original data
        // $processedChunk is the localized data
    }
);
```

## Requirements

- PHP 8.1 or higher
- Composer
- GuzzleHTTP 7.0+
- Symfony DOM Crawler
- Symfony CSS Selector

## License

This SDK is licensed under the Apache 2.0 License - see the LICENSE file in the repository root for details.
