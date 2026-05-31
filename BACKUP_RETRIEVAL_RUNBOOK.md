# Backup Retrieval Runbook (crm.piriyathu.com)

## Server
- Host: `194.238.19.113`
- User: `joseph`

## 1) Discover latest DB + uploads backup
```bash
ssh joseph@194.238.19.113 \
  "find /var/backups/sanju -maxdepth 2 -type f \( -name 'postgres.sql.gz' -o -name 'uploads.tar.gz' \) | sort"
```

## 2) Create local backup folder
```bash
mkdir -p ./backups/remote-crm-$(date +%Y%m%d)
```

## 3) Download backup files
```bash
scp joseph@194.238.19.113:/var/backups/sanju/<STAMP>/postgres.sql.gz \
  ./backups/remote-crm-$(date +%Y%m%d)/<STAMP>-postgres.sql.gz

scp joseph@194.238.19.113:/var/backups/sanju/<STAMP>/uploads.tar.gz \
  ./backups/remote-crm-$(date +%Y%m%d)/<STAMP>-uploads.tar.gz
```

## 4) Verify integrity and store metadata
```bash
shasum -a 256 ./backups/remote-crm-$(date +%Y%m%d)/*
ls -lh ./backups/remote-crm-$(date +%Y%m%d)
```

Create `backup-metadata.log` containing:
- remote source paths
- local file paths
- sizes (bytes)
- SHA256 hashes
- UTC timestamp

## Last successful retrieval
- Local directory: `./backups/remote-crm-20260502`
- DB file: `20260502T021502Z-postgres.sql.gz` (40925 bytes)
- Uploads file: `20260502T021502Z-uploads.tar.gz` (105 bytes)
- Metadata log: `./backups/remote-crm-20260502/backup-metadata.log`
