# Everything runs in Docker (image `tapeless-dev`: Node, Chromium, Lighthouse): nothing is installed on the host.
DOCKER = docker run --rm -v "$(CURDIR)":/app -w /app -u $(shell id -u):$(shell id -g) -e HOME=/tmp -e BUILD_DATE=$(shell date +%F) tapeless-dev

.PHONY: image test check pages brand lighthouse e2e shots serve all
image:        ## build the dev toolbox image
	docker build -t tapeless-dev .
test:         ## unit tests (node --test)
	$(DOCKER) node --test tests/
check:        ## links, meta, sizes, sitemap, no Google in markup
	$(DOCKER) node scripts/check.mjs
pages:        ## regenerate the static HTML pages
	$(DOCKER) node scripts/pages.mjs
brand:        ## favicon set, OG image, robots/humans/sitemap/manifest, pages
	$(DOCKER) sh -c "node scripts/brand/build.mjs && node scripts/pages.mjs && node scripts/brand/raster.mjs"
e2e:          ## browser checks: network and cookies without/with/after-withdrawn consent
	$(DOCKER) node scripts/e2e.mjs
shots:        ## screenshots into .shots/
	$(DOCKER) node scripts/shots.mjs
lighthouse:   ## Lighthouse (mobile) for the home page
	$(DOCKER) node scripts/lighthouse.mjs
serve:        ## local preview on http://localhost:8080 (Python inside Docker)
	docker run --rm -it -p 8080:8080 -v "$(CURDIR)":/app -w /app tapeless-dev python3 -m http.server 8080
all: pages brand test check e2e
