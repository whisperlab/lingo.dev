# Lingo.dev PHP SDK

The official PHP SDK for interacting with the Lingo.dev API. This SDK allows you to easily integrate Lingo.dev's localization capabilities into your PHP applications.

## Features

*   Recognize the locale of text.
*   Localize simple text strings.
*   Localize complex nested objects/arrays.
*   Batch localize multiple text strings in a single request.
*   Localize chat messages.

## Requirements

*   PHP 8.1 or higher
*   Composer
*   A Lingo.dev API Key (obtainable from [lingo.dev](https://lingo.dev))

## Installation

You can install the SDK via Composer. If you are starting a new project, you can initialize it with Composer first.

**1. Create a New PHP Project (if needed)**

If you don't have an existing project, create a new directory and initialize Composer:

```bash
mkdir my-php-app
cd my-php-app
composer init --name=my-vendor/my-app --description="My Awesome PHP App" --author="Your Name <you@example.com>" --type=project --require-php=">=8.1" --no-interaction
# Follow the prompts or accept defaults
```

**2. Install the Lingo.dev PHP SDK**

Navigate to your project directory and run the following Composer command:

```bash
composer require lingodotdev/sdk
```

This will download the SDK and its dependencies into your project's `vendor` directory and update your `composer.json` and `composer.lock` files.

**3. Autoloading**

Ensure your project is set up to use Composer's autoloader. Typically, you include this line at the beginning of your PHP scripts:

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

// Your code here...
```

## Usage Tutorial

Here's a step-by-step guide on how to use the SDK:

**1. Include Autoloader and Import the SDK**

Start your PHP file by including the Composer autoloader and importing the `LingoDotDevEngine` class:

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use LingoDotDev\PhpSdk\LingoDotDevEngine;
```

**2. Instantiate the SDK Client**

You need your Lingo.dev API key to create an instance of the engine. You can pass configuration options as an array to the constructor.

```php
$apiKey = getenv('LINGODOTDEV_API_KEY') ?: 'YOUR_API_KEY'; // Replace with your actual API key or load from env

if (!$apiKey) {
    die("Error: Lingo.dev API key is not set. Set the LINGODOTDEV_API_KEY environment variable or replace YOUR_API_KEY in the code.");
}

$config = [
    'apiKey' => $apiKey,
    // Optional: Specify a different API URL if needed
    // 'apiUrl' => 'https://api.lingo.dev',
    // Optional: Set a default timeout for API requests (in seconds)
    // 'timeout' => 30,
    // Optional: Configure retry attempts
    // 'retries' => 3,
    // Optional: Set a callback for progress updates during batch operations
    // 'onProgress' => function($progress) {
    //     echo "Localization progress: " . ($progress * 100) . "%\n";
    // }
];

try {
    $lingoEngine = new LingoDotDevEngine($config);
} catch (\Exception $e) {
    die("Failed to initialize Lingo.dev SDK: " . $e->getMessage());
}

```

**3. Call API Methods**

Now you can use the `$lingoEngine` instance to call the various API methods.

*   **Recognize Locale:**

    ```php
    try {
        $textToRecognize = "Bonjour le monde!";
        $localeInfo = $lingoEngine->recognizeLocale($textToRecognize);
        echo "Detected Locale: " . $localeInfo['locale'] . "\n"; // Output: Detected Locale: fr
        // $localeInfo also contains 'language', 'region', 'script'

    } catch (\Exception $e) {
        echo "Error recognizing locale: " . $e->getMessage() . "\n";
    }
    ```

*   **Localize Text:**

    ```php
    try {
        $textToLocalize = "Hello, world!";
        $targetLocale = "es"; // Target locale (e.g., Spanish)
        $localizedText = $lingoEngine->localizeText($textToLocalize, $targetLocale);
        echo "Localized Text (es): " . $localizedText . "\n"; // Output: Localized Text (es): ¡Hola, mundo!

        // You can also provide context
        $context = "A standard greeting in programming examples.";
        $localizedTextWithContext = $lingoEngine->localizeText($textToLocalize, $targetLocale, $context);
        echo "Localized Text with Context (es): " . $localizedTextWithContext . "\n";

    } catch (\Exception $e) {
        echo "Error localizing text: " . $e->getMessage() . "\n";
    }
    ```

*   **Localize Object/Array:**

    ```php
    try {
        $objectToLocalize = [
            'title' => "Welcome",
            'body' => "This is the content.",
            'author' => [
                'name' => "John Doe",
                'bio' => "An example author."
            ],
            'tags' => ["greeting", "example"]
        ];
        $targetLocale = "de"; // Target locale (e.g., German)

        $localizedObject = $lingoEngine->localizeObject($objectToLocalize, $targetLocale);

        echo "Localized Object (de):\n";
        print_r($localizedObject);
        /* Output (example):
        Localized Object (de):
        Array
        (
            [title] => Willkommen
            [body] => Dies ist der Inhalt.
            [author] => Array
                (
                    [name] => John Doe
                    [bio] => Ein Beispielautor.
                )
            [tags] => Array
                (
                    [0] => greeting
                    [1] => example
                )
        )
        */

    } catch (\Exception $e) {
        echo "Error localizing object: " . $e->getMessage() . "\n";
    }
    ```

*   **Batch Localize Text:**

    ```php
    try {
        $textsToLocalize = [
            "Hello",
            "Goodbye",
            "Thank you"
        ];
        $targetLocale = "fr"; // Target locale (e.g., French)

        // Example progress callback (optional)
        $lingoEngine->setConfig([
            'onProgress' => function($progress) {
                echo "Batch progress: " . round($progress * 100) . "%\n";
            }
        ]);

        $localizedTexts = $lingoEngine->batchLocalizeText($textsToLocalize, $targetLocale);

        echo "Batch Localized Texts (fr):\n";
        print_r($localizedTexts);
        /* Output (example):
        Batch progress: 0%
        Batch progress: 100%
        Batch Localized Texts (fr):
        Array
        (
            [0] => Bonjour
            [1] => Au revoir
            [2] => Merci
        )
        */

    } catch (\Exception $e) {
        echo "Error batch localizing texts: " . $e->getMessage() . "\n";
    }
    ```

*   **Localize Chat:**

    ```php
    try {
        $chatMessages = [
            ['role' => 'system', 'content' => "You are a helpful assistant."],
            ['role' => 'user', 'content' => "What is the capital of France?"],
            ['role' => 'assistant', 'content' => "The capital of France is Paris."]
        ];
        $targetLocale = "ja"; // Target locale (e.g., Japanese)

        $localizedChat = $lingoEngine->localizeChat($chatMessages, $targetLocale);

        echo "Localized Chat (ja):\n";
        print_r($localizedChat);
        /* Output (example):
        Localized Chat (ja):
        Array
        (
            [0] => Array
                (
                    [role] => system
                    [content] => あなたは役に立つアシスタントです。
                )
            [1] => Array
                (
                    [role] => user
                    [content] => フランスの首都はどこですか？
                )
            [2] => Array
                (
                    [role] => assistant
                    [content] => フランスの首都はパリです。
                )
        )
        */

    } catch (\Exception $e) {
        echo "Error localizing chat: " . $e->getMessage() . "\n";
    }
    ```

**4. Error Handling**

All SDK methods can throw exceptions (e.g., `\GuzzleHttp\Exception\RequestException` for network issues, `\Exception` for API errors or configuration problems). Wrap your SDK calls in `try...catch` blocks to handle potential errors gracefully.

## Configuration Options

When creating the `LingoDotDevEngine` instance, you can pass an associative array with the following options:

*   `apiKey` (string, required): Your Lingo.dev API key.
*   `apiUrl` (string, optional): The base URL for the Lingo.dev API. Defaults to `https://api.lingo.dev`.
*   `timeout` (int, optional): Request timeout in seconds. Defaults to 30.
*   `retries` (int, optional): Number of retry attempts on failure. Defaults to 3.
*   `onProgress` (callable, optional): A callback function that receives a float between 0.0 and 1.0 indicating the progress of batch operations. `function($progress) { ... }`.

You can also update the configuration after instantiation using the `setConfig` method:

```php
$lingoEngine->setConfig([ 'timeout' => 60 ]);
```

## Contributing

Contributions are welcome! Please refer to the main repository's contribution guidelines.

## License

This SDK is licensed under the Apache-2.0 License. See the LICENSE file for details.
