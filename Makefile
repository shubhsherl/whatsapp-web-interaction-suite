# Makefile for WhatsApp Web Interaction Suite Extension (Chrome and Firefox)

# Extension name
EXTENSION_NAME := whats-messenger
VERSION := $(shell grep -o '"version":"[^"]*"' manifest.json | cut -d'"' -f4)
BUILD_DIR := build
DIST_DIR := dist
CHROME_BUILD_DIR := $(BUILD_DIR)/chrome
FIREFOX_BUILD_DIR := $(BUILD_DIR)/firefox

.PHONY: clean build build-chrome build-firefox zip-chrome zip-firefox

# Default target
all: clean build zip

# Clean build and dist directories
clean:
	rm -rf $(BUILD_DIR) $(DIST_DIR)
	mkdir -p $(CHROME_BUILD_DIR) $(FIREFOX_BUILD_DIR) $(DIST_DIR)

# Build both Chrome and Firefox extensions
build: build-chrome build-firefox

# Build Chrome extension
build-chrome: 
	@echo "Building Chrome extension version $(VERSION)..."
	cp -r manifest.json popup.html index.html LICENSE README.md $(CHROME_BUILD_DIR)/
	cp -r src $(CHROME_BUILD_DIR)/
	cp -r icon-*.png icon-*.svg $(CHROME_BUILD_DIR)/
	cp -r doc $(CHROME_BUILD_DIR)/
	@echo "Chrome extension build complete!"

# Build Firefox extension
build-firefox:
	@echo "Building Firefox extension version $(VERSION)..."
	cp -r popup.html index.html LICENSE README.md $(FIREFOX_BUILD_DIR)/
	cp manifest.firefox.json $(FIREFOX_BUILD_DIR)/manifest.json
	cp -r src $(FIREFOX_BUILD_DIR)/
	cp -r icon-*.png icon-*.svg $(FIREFOX_BUILD_DIR)/
	cp -r doc $(FIREFOX_BUILD_DIR)/
	@echo "Firefox extension build complete!"

# Create zip files for Chrome and Firefox
zip: zip-chrome zip-firefox

# Create a zip file for Chrome Web Store submission
zip-chrome: build-chrome
	@echo "Creating zip file for Chrome Web Store submission..."
	cd $(CHROME_BUILD_DIR) && zip -r ../../$(DIST_DIR)/$(EXTENSION_NAME)-chrome-$(VERSION).zip * -x "*.DS_Store" -x "*.git*" -x "*__MACOSX*"
	@echo "Chrome zip file created at $(DIST_DIR)/$(EXTENSION_NAME)-chrome-$(VERSION).zip"

# Create a zip file for Firefox Add-ons submission
zip-firefox: build-firefox
	@echo "Creating zip file for Firefox Add-ons submission..."
	cd $(FIREFOX_BUILD_DIR) && zip -r ../../$(DIST_DIR)/$(EXTENSION_NAME)-firefox-$(VERSION).zip * -x "*.DS_Store" -x "*.git*" -x "*__MACOSX*"
	@echo "Firefox zip file created at $(DIST_DIR)/$(EXTENSION_NAME)-firefox-$(VERSION).zip"

# Show help
help:
	@echo "Available targets:"
	@echo "  all          : Clean, build, and create zip files for both browsers (default)"
	@echo "  clean        : Clean build and dist directories"
	@echo "  build        : Build both Chrome and Firefox extensions"
	@echo "  build-chrome : Build only Chrome extension"
	@echo "  build-firefox: Build only Firefox extension"
	@echo "  zip          : Create zip files for both browsers"
	@echo "  zip-chrome   : Create zip file for Chrome Web Store submission"
	@echo "  zip-firefox  : Create zip file for Firefox Add-ons submission"
	@echo "  help         : Show this help message" 