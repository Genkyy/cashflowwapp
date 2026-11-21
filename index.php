<?php
// Laragon Apache/Nginx Auto-Redirect to Bang Andi App
$distDir = __DIR__ . '/bang-andi/dist/';

if (file_exists($distDir . 'index.html')) {
    header('Location: bang-andi/dist/');
    exit;
} else {
    header('Location: bang-andi/');
    exit;
}
