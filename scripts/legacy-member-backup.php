<?php
// Legacy member backup exporter for GNG migration.
//
// Upload this file to the legacy PHP document root, open it in a browser,
// download the member bundle, then delete it from the server immediately.

define('BACKUP_PASSWORD', 'CHANGE_ME_BEFORE_UPLOAD');

// Optional fallback if /lib/db_info.php is not available on the server.
define('DB_HOST', '');
define('DB_NAME', '');
define('DB_USER', '');
define('DB_PASSWORD', '');
define('DB_CHARSET', 'euckr');
define('OUTPUT_CHARSET', 'utf-8');

$defaultTables = array(
    'member',
    'social_member',
    'member_addrs',
    'member_withdraw',
    'point_table',
);

function fail($message)
{
    if (function_exists('http_response_code')) http_response_code(500);
    else header('HTTP/1.1 500 Internal Server Error');
    echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    exit;
}

function safe_equals($expected, $actual)
{
    if (!is_string($expected) || !is_string($actual)) return false;
    if (function_exists('hash_equals')) return hash_equals($expected, $actual);
    if (strlen($expected) !== strlen($actual)) return false;

    $diff = 0;
    for ($i = 0; $i < strlen($expected); $i++) {
        $diff |= ord($expected[$i]) ^ ord($actual[$i]);
    }

    return $diff === 0;
}

function safe_name($name)
{
    return preg_replace('/[^a-zA-Z0-9_]/', '', $name);
}

function quoted_table($name)
{
    return '`' . str_replace('`', '``', $name) . '`';
}

function sql_value($conn, $value)
{
    if ($value === null) return 'NULL';
    $escaped = mysqli_real_escape_string($conn, $value);
    return "'" . convert_output($escaped) . "'";
}

function iconv_charset($charset)
{
    $normalized = strtolower(str_replace(array('-', '_'), '', $charset));
    if ($normalized === 'euckr') return 'EUC-KR';
    if ($normalized === 'utf8' || $normalized === 'utf8mb4') return 'UTF-8';
    return $charset;
}

function convert_output($value)
{
    if (!is_string($value)) return $value;

    $from = iconv_charset(DB_CHARSET);
    $to = iconv_charset(OUTPUT_CHARSET);
    if (strtoupper($from) === strtoupper($to)) return $value;
    if (!function_exists('iconv')) return $value;

    $converted = @iconv($from, $to . '//IGNORE', $value);
    return $converted === false ? $value : $converted;
}

function normalize_table_list($value)
{
    if (!is_string($value) || trim($value) === '') return array();
    $parts = explode(',', $value);
    $tables = array();
    foreach ($parts as $part) {
        $name = safe_name(trim($part));
        if ($name !== '' && !in_array($name, $tables, true)) $tables[] = $name;
    }
    return $tables;
}

function load_db_info()
{
    $paths = array(
        $_SERVER['DOCUMENT_ROOT'] . '/lib/db_info.php',
        __DIR__ . '/lib/db_info.php',
        dirname(__DIR__) . '/lib/db_info.php',
    );

    foreach ($paths as $path) {
        if (file_exists($path)) {
            include_once $path;
            if (isset($arrDBINFO) && is_array($arrDBINFO)) {
                return array(
                    'host' => $arrDBINFO[0],
                    'user' => $arrDBINFO[2],
                    'name' => $arrDBINFO[3],
                    'password' => $arrDBINFO[4],
                    'charset' => DB_CHARSET,
                );
            }
        }
    }

    return array(
        'host' => DB_HOST,
        'user' => DB_USER,
        'name' => DB_NAME,
        'password' => DB_PASSWORD,
        'charset' => DB_CHARSET,
    );
}

function connect_db()
{
    $db = load_db_info();
    if ($db['host'] === '' || $db['user'] === '' || $db['name'] === '') {
        fail('DB 정보가 없습니다. /lib/db_info.php 위치를 확인하거나 이 파일 상단의 DB_* 값을 임시로 채워주세요.');
    }

    $conn = @mysqli_connect($db['host'], $db['user'], $db['password'], $db['name']);
    if (!$conn) fail('DB 연결 실패: ' . mysqli_connect_error());
    mysqli_set_charset($conn, $db['charset']);

    return $conn;
}

function existing_tables($conn)
{
    $result = mysqli_query($conn, 'SHOW TABLES');
    if (!$result) fail('테이블 목록 조회 실패: ' . mysqli_error($conn));

    $tables = array();
    while ($row = mysqli_fetch_row($result)) $tables[] = $row[0];
    return $tables;
}

function count_table($conn, $table)
{
    $result = mysqli_query($conn, 'SELECT COUNT(*) FROM ' . quoted_table($table));
    if (!$result) return null;
    $row = mysqli_fetch_row($result);
    return (int) $row[0];
}

function dump_table($conn, $table, $includeDrop)
{
    $tableSql = quoted_table($table);
    $create = mysqli_query($conn, 'SHOW CREATE TABLE ' . $tableSql);
    if (!$create) {
        echo "\n-- SKIP {$table}: SHOW CREATE TABLE failed: " . mysqli_error($conn) . "\n";
        return;
    }

    $createRow = mysqli_fetch_row($create);
    echo "\n-- --------------------------------------------------------\n";
    echo "-- Table: {$table}\n";
    echo "-- Rows: " . count_table($conn, $table) . "\n";
    echo "-- --------------------------------------------------------\n\n";

    if ($includeDrop) echo "DROP TABLE IF EXISTS {$tableSql};\n";
    echo $createRow[1] . ";\n\n";

    $data = mysqli_query($conn, 'SELECT * FROM ' . $tableSql);
    if (!$data) {
        echo "-- SKIP {$table}: SELECT failed: " . mysqli_error($conn) . "\n";
        return;
    }

    $fields = mysqli_fetch_fields($data);
    $columns = array();
    foreach ($fields as $field) $columns[] = quoted_table($field->name);
    $columnSql = implode(', ', $columns);

    $rowCount = 0;
    while ($row = mysqli_fetch_assoc($data)) {
        $values = array();
        foreach ($row as $value) $values[] = sql_value($conn, $value);
        echo 'INSERT INTO ' . $tableSql . ' (' . $columnSql . ') VALUES (' . implode(', ', $values) . ");\n";
        $rowCount++;
    }

    echo "\n-- Dumped {$rowCount} rows from {$table}\n";
}

function json_flags()
{
    $flags = 0;
    if (defined('JSON_UNESCAPED_UNICODE')) $flags |= JSON_UNESCAPED_UNICODE;
    if (defined('JSON_UNESCAPED_SLASHES')) $flags |= JSON_UNESCAPED_SLASHES;
    return $flags;
}

function json_line($payload)
{
    echo json_encode($payload, json_flags()) . "\n";
}

function output_row($row)
{
    $converted = array();
    foreach ($row as $key => $value) {
        $converted[$key] = convert_output($value);
    }
    return $converted;
}

function dump_table_json($conn, $table)
{
    $tableSql = quoted_table($table);
    $data = mysqli_query($conn, 'SELECT * FROM ' . $tableSql);
    if (!$data) {
        json_line(array(
            'type' => 'table',
            'table' => $table,
            'rows' => 0,
            'error' => convert_output(mysqli_error($conn)),
        ));
        return 0;
    }

    $fields = mysqli_fetch_fields($data);
    $columns = array();
    foreach ($fields as $field) $columns[] = $field->name;
    $expectedRows = count_table($conn, $table);

    json_line(array(
        'type' => 'table',
        'table' => $table,
        'columns' => $columns,
        'rows' => $expectedRows,
    ));

    $rowCount = 0;
    while ($row = mysqli_fetch_assoc($data)) {
        json_line(array(
            'type' => 'row',
            'table' => $table,
            'data' => output_row($row),
        ));
        $rowCount++;
        if ($rowCount % 500 === 0 && function_exists('flush')) flush();
    }

    return $rowCount;
}

if (BACKUP_PASSWORD === 'CHANGE_ME_BEFORE_UPLOAD') {
    fail('BACKUP_PASSWORD를 변경한 뒤 서버에 업로드하세요.');
}

$authorized = false;
$cookieHash = md5(BACKUP_PASSWORD . '|' . $_SERVER['SERVER_NAME']);
if (isset($_POST['pwd']) && safe_equals(BACKUP_PASSWORD, $_POST['pwd'])) {
    $authorized = true;
    setcookie('gng_member_backup_auth', $cookieHash, time() + 3600, '', '', false, true);
} elseif (isset($_COOKIE['gng_member_backup_auth']) && safe_equals($cookieHash, $_COOKIE['gng_member_backup_auth'])) {
    $authorized = true;
}

if (!$authorized) {
    ?><!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>GNG 회원 DB 백업</title>
<style>
body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px}
.box{max-width:420px;margin:12vh auto;background:#fff;border:1px solid #ddd;padding:28px}
input,button{font-size:15px;padding:10px;width:100%;box-sizing:border-box;margin-top:10px}
button{background:#111;color:#fff;border:0;cursor:pointer}
p{color:#777;font-size:13px;line-height:1.5}
</style>
</head>
<body>
<div class="box">
<h2>GNG 회원 DB 백업</h2>
<p>회원, 소셜 계정, 주소, 포인트 등 회원 관련 테이블을 백업 파일로 내려받습니다.</p>
<form method="post">
<input type="password" name="pwd" placeholder="백업 비밀번호" autofocus>
<button type="submit">접속</button>
</form>
</div>
</body>
</html><?php
    exit;
}

$conn = connect_db();
$allTables = existing_tables($conn);
$requestedTables = normalize_table_list(isset($_GET['tables']) ? $_GET['tables'] : '');
$targetTables = count($requestedTables) > 0 ? $requestedTables : $defaultTables;
$targetTables = array_values(array_intersect($targetTables, $allTables));

$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'download') {
    $includeDrop = isset($_GET['drop']) && $_GET['drop'] === '1';
    $stamp = date('Ymd_His');

    header('Content-Type: text/plain; charset=' . OUTPUT_CHARSET);
    header('Content-Disposition: attachment; filename="gng_member_backup_' . $stamp . '.sql"');

    echo "-- GNG legacy member backup\n";
    echo "-- Created at: " . date('Y-m-d H:i:s') . "\n";
    echo "-- Legacy URL: https://xn--ef5bt3fba.kr/\n";
    echo "-- DB charset: " . DB_CHARSET . "\n";
    echo "-- Output charset: " . OUTPUT_CHARSET . "\n";
    echo "-- Tables: " . implode(', ', $targetTables) . "\n";
    echo "-- Missing default tables: " . implode(', ', array_values(array_diff($defaultTables, $allTables))) . "\n\n";
    echo "SET NAMES utf8;\n";
    echo "SET FOREIGN_KEY_CHECKS=0;\n\n";

    foreach ($targetTables as $table) dump_table($conn, $table, $includeDrop);

    echo "\nSET FOREIGN_KEY_CHECKS=1;\n";
    echo "-- Backup complete.\n";
    mysqli_close($conn);
    exit;
}

if ($action === 'download-json') {
    $stamp = date('Ymd_His');
    $dumpedRows = array();

    header('Content-Type: application/x-ndjson; charset=' . OUTPUT_CHARSET);
    header('Content-Disposition: attachment; filename="gng_member_backup_' . $stamp . '.ndjson"');
    header('X-Content-Type-Options: nosniff');

    json_line(array(
        'type' => 'meta',
        'format' => 'gng-legacy-member-ndjson',
        'formatVersion' => 1,
        'createdAt' => date('c'),
        'legacyUrl' => 'https://xn--ef5bt3fba.kr/',
        'dbCharset' => DB_CHARSET,
        'outputCharset' => OUTPUT_CHARSET,
        'tables' => $targetTables,
        'missingDefaultTables' => array_values(array_diff($defaultTables, $allTables)),
    ));

    foreach ($targetTables as $table) {
        $dumpedRows[$table] = dump_table_json($conn, $table);
    }

    json_line(array(
        'type' => 'complete',
        'createdAt' => date('c'),
        'tables' => $dumpedRows,
        'note' => '점검창 없이 백업한 경우 이 시점 이후 레거시 변경분은 포함되지 않습니다.',
    ));
    mysqli_close($conn);
    exit;
}

?><!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>GNG 회원 DB 백업</title>
<style>
body{font-family:Arial,sans-serif;max-width:960px;margin:40px auto;padding:0 20px;color:#222}
table{width:100%;border-collapse:collapse;margin:18px 0}
th,td{border:1px solid #ddd;padding:9px 11px;text-align:left}
th{background:#f3f3f3}
.btn{display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 14px;margin-right:8px}
.note{background:#fff8d8;border:1px solid #ead47a;padding:12px;margin:16px 0;font-size:14px}
code{background:#f4f4f4;padding:2px 4px}
</style>
</head>
<body>
<h1>GNG 회원 DB 백업</h1>
<div class="note">다운로드 후 이 PHP 파일은 서버에서 바로 삭제하세요. 덤프 파일에는 개인정보와 비밀번호 해시가 포함됩니다.</div>
<p>
<a class="btn" href="?action=download">회원 관련 SQL 다운로드</a>
<a class="btn" href="?action=download&drop=1">DROP 포함 SQL 다운로드</a>
<a class="btn" href="?action=download-json">마이그레이션용 NDJSON 다운로드</a>
</p>
<p>특정 테이블만 받을 때: <code>?action=download&amp;tables=member,social_member,member_addrs</code></p>
<table>
<thead><tr><th>대상 테이블</th><th>상태</th><th>건수</th></tr></thead>
<tbody>
<?php foreach ($defaultTables as $table): ?>
<tr>
<td><?php echo htmlspecialchars($table, ENT_QUOTES, 'UTF-8'); ?></td>
<?php if (in_array($table, $allTables, true)): ?>
<td>있음</td>
<td><?php echo number_format(count_table($conn, $table)); ?></td>
<?php else: ?>
<td>없음</td>
<td>-</td>
<?php endif; ?>
</tr>
<?php endforeach; ?>
</tbody>
</table>
</body>
</html><?php
mysqli_close($conn);
