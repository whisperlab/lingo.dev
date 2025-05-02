<?php
/**
 * Packagist Publishing Script
 * 
 * This script handles publishing a package to Packagist using the Packagist API.
 * It requires the following environment variables:
 * - PACKAGIST_USERNAME: The Packagist username
 * - PACKAGIST_API_TOKEN: The Packagist API token
 * - PACKAGE_NAME: The name of the package to publish (e.g., vendor/package)
 * - SUBDIRECTORY_PATH: (Optional) The path to the subdirectory containing the package
 * 
 * @php      7.4
 */

$username = getenv('PACKAGIST_USERNAME');
$apiToken = getenv('PACKAGIST_API_TOKEN');
$packageName = getenv('PACKAGE_NAME');
$subdirectoryPath = getenv('SUBDIRECTORY_PATH') ?: '';

if (!$username || !$apiToken || !$packageName) {
    echo "Error: Missing required environment variables.\n";
    echo "Please ensure PACKAGIST_USERNAME, PACKAGIST_API_TOKEN, and PACKAGE_NAME are set.\n";
    exit(1);
}

echo "Starting Packagist publishing process for package: $packageName\n";
if ($subdirectoryPath) {
    echo "Package is located in subdirectory: $subdirectoryPath\n";
}

$checkUrl = "https://packagist.org/packages/$packageName.json";
$ch = curl_init($checkUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json'
]);

echo "Checking if package exists on Packagist...\n";
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$packageExists = ($httpCode === 200);

if ($packageExists) {
    echo "Package $packageName already exists on Packagist. Updating...\n";
    $apiUrl = "https://packagist.org/api/update-package?username=$username&apiToken=$apiToken";
} else {
    echo "Package $packageName does not exist on Packagist. Creating new package...\n";
    echo "NOTE: For packages in subdirectories, you must first manually register the package on Packagist.\n";
    echo "Visit https://packagist.org/packages/submit and enter the repository URL and subdirectory path.\n";
    $apiUrl = "https://packagist.org/api/create-package?username=$username&apiToken=$apiToken";
}

$repoUrl = "https://github.com/lingodotdev/lingo.dev";

$data = [
    'repository' => [
        'url' => $repoUrl
    ]
];

if ($subdirectoryPath) {
    $data['repository']['subdirectory'] = $subdirectoryPath;
}

$ch = curl_init($apiUrl);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Accept: application/json'
]);

echo "Sending request to Packagist API ($apiUrl)...\n";
echo "Request payload: " . json_encode($data, JSON_PRETTY_PRINT) . "\n";
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    echo "Error: " . curl_error($ch) . "\n";
    curl_close($ch);
    exit(1);
}

curl_close($ch);

$responseData = json_decode($response, true);

echo "HTTP Response Code: $httpCode\n";
echo "Response: " . print_r($responseData, true) . "\n";

if ($httpCode >= 200 && $httpCode < 300) {
    echo "Package $packageName successfully " . ($packageExists ? "updated" : "submitted") . " to Packagist!\n";
    exit(0);
} else {
    echo "Failed to " . ($packageExists ? "update" : "submit") . " package $packageName to Packagist.\n";
    
    if ($subdirectoryPath && $httpCode === 404) {
        echo "\nFor packages in subdirectories, you may need to:\n";
        echo "1. Manually register the package on Packagist first: https://packagist.org/packages/submit\n";
        echo "2. Set up a GitHub webhook to notify Packagist of updates: https://packagist.org/about#how-to-update-packages\n";
    }
    
    exit(1);
}
