#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v timeout >/dev/null || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

# O modelo de OCR é reconstruído a partir da dependência oficial. Assim o
# repositório pode ser restaurado sem versionar um arquivo binário grande.
ocr_source="${SITES_PROJECT_ROOT}/node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz"
ocr_target="${SITES_PROJECT_ROOT}/public/ocr/por.traineddata.gz"
if [[ -f "${ocr_source}" ]]; then
  mkdir -p "$(dirname "${ocr_target}")"
  cp "${ocr_source}" "${ocr_target}"
fi

echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build

"${script_dir}/validate-artifact.sh"
