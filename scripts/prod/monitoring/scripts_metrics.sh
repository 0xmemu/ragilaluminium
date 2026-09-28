#!/usr/bin/env bash
# Metrik sistem tiap 5 menit → CSV harian. Data untuk analisis tren & capacity planning.
# Output: /root/backups/metrics/YYYY-MM-DD.csv
# Kolom: timestamp, load1, cpu_pct, mem_pct, disk_pct, inode_pct, redis_mem_mb, redis_keys,
#        mysql_threads, mysql_slow_queries, queue_default, queue_imports, queue_media, http_home
set -uo pipefail

DIR=/root/backups/metrics
mkdir -p "$DIR"
TS=$(date '+%F %T')
DAY=$(date '+%F')
F="$DIR/$DAY.csv"
[ -f "$F" ] || echo "timestamp,load1,cpu_pct,mem_pct,disk_pct,inode_pct,redis_mem_mb,redis_keys,mysql_threads,mysql_slow,queue_def,queue_imp,queue_med,http_home" > "$F"

# load average 1 menit
LOAD1=$(cat /proc/loadavg | awk '{print $1}')

# CPU usage (selisih /proc/stat)
read -r _ CPU_USER CPU_NICE CPU_SYS CPU_IDLE _ < <(grep '^cpu ' /proc/stat)
TOTAL1=$((CPU_USER+CPU_NICE+CPU_SYS+CPU_IDLE))
sleep 1
read -r _ CPU_USER2 CPU_NICE2 CPU_SYS2 CPU_IDLE2 _ < <(grep '^cpu ' /proc/stat)
TOTAL2=$((CPU_USER2+CPU_NICE2+CPU_SYS2+CPU_IDLE2))
IDLE_D=$((CPU_IDLE2-CPU_IDLE)); TOT_D=$((TOTAL2-TOTAL1))
[ "$TOT_D" -gt 0 ] && CPU_PCT=$((100*(TOT_D-IDLE_D)/TOT_D)) || CPU_PCT=0

# memori
MEM_PCT=$(free -m | awk 'NR==2 {printf "%d", $3*100/$2}')
# disk & inode
DISK_PCT=$(df -h / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
INODE_PCT=$(df -i / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')

# redis
REDIS_MEM=$(redis-cli info memory 2>/dev/null | awk -F: '/used_memory:/{printf "%.1f", $2/1048576}')
REDIS_KEYS=$(redis-cli info keyspace 2>/dev/null | grep -c 'keys=' || true)

# mysql
MYSQL_THREADS=$(mysql -N -e 'SHOW GLOBAL STATUS LIKE "Threads_running";' 2>/dev/null | awk '{print $2}')
MYSQL_SLOW=$(mysql -N -e 'SHOW GLOBAL STATUS LIKE "Slow_queries";' 2>/dev/null | awk '{print $2}')

# queue
QD=$(redis-cli -n 0 llen queues:default 2>/dev/null || echo 0)
QI=$(redis-cli -n 0 llen queues:imports 2>/dev/null || echo 0)
QM=$(redis-cli -n 0 llen queues:media 2>/dev/null || echo 0)

# http home
HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8200/ 2>/dev/null)

echo "$TS,$LOAD1,$CPU_PCT,$MEM_PCT,$DISK_PCT,$INODE_PCT,$REDIS_MEM,$REDIS_KEYS,${MYSQL_THREADS:-0},${MYSQL_SLOW:-0},${QD:-0},${QI:-0},${QM:-0},${HTTP:-0}" >> "$F"

# Rotasi: hapus CSV > 90 hari
find "$DIR" -name '*.csv' -mtime +90 -delete 2>/dev/null
