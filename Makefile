# Makefile for WhatsApp Web Interaction Suite Chrome Extension

# Extension name
EXTENSION_NAME := whats-messenger
VERSION := $(shell grep -o '"version":"[^"]*"' manifest.json | cut -d'"' -f4)
BUILD_DIR := build
DIST_DIR := dist

.PHONY: clean build zip

# Default target
all: clean build zip

# Clean build and dist directories
clean:
	rm -rf $(BUILD_DIR) $(DIST_DIR)
	mkdir -p $(BUILD_DIR) $(DIST_DIR)

# Build the extension (copy necessary files to build directory)
build: create_dirs
	@echo "Building extension version $(VERSION)..."
	cp -r manifest.json popup.html index.html LICENSE README.md $(BUILD_DIR)/
	cp -r src $(BUILD_DIR)/
	cp -r icon-*.png icon-*.svg $(BUILD_DIR)/
	cp -r doc $(BUILD_DIR)/

# Create necessary directories
create_dirs:
	mkdir -p $(BUILD_DIR) $(DIST_DIR)

# Create a zip file for Chrome Web Store submission
zip: build
	@echo "Creating zip file for Chrome Web Store submission..."
	cd $(BUILD_DIR) && zip -r ../$(DIST_DIR)/$(EXTENSION_NAME)-$(VERSION).zip * -x "*.DS_Store" -x "*.git*" -x "*__MACOSX*"
	@echo "Zip file created at $(DIST_DIR)/$(EXTENSION_NAME)-$(VERSION).zip"

# Show help
help:
	@echo "Available targets:"
	@echo "  all     : Clean, build, and create zip file (default)"
	@echo "  clean   : Clean build and dist directories"
	@echo "  build   : Build the extension"
	@echo "  zip     : Create a zip file for Chrome Web Store submission"
	@echo "  help    : Show this help message" 