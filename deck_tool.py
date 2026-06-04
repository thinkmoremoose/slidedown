#!/usr/bin/env python3
import os
import sys
import json
import re
import argparse
from html.parser import HTMLParser

class SimpleMarkdown:
    @staticmethod
    def to_html(text):
        # Basic Markdown converter (Regex-based)
        # Headings
        text = re.sub(r'^# (.*)$', r'<h1>\1</h1>', text, flags=re.M)
        text = re.sub(r'^## (.*)$', r'<h2>\1</h2>', text, flags=re.M)
        text = re.sub(r'^### (.*)$', r'<h3>\1</h3>', text, flags=re.M)
        
        # Lists
        text = re.sub(r'^\* (.*)$', r'<li>\1</li>', text, flags=re.M)
        text = re.sub(r'^- (.*)$', r'<li>\1</li>', text, flags=re.M)
        
        # Bold / Italic
        text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
        text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)
        
        # Code
        text = re.sub(r'`(.*?)`', r'<code>\1</code>', text)
        
        # Fragments (Special SlideDown syntax: class="fragment")
        text = text.replace('[[fragment]]', ' class="fragment"')
        
        return text

class SlideLinter(HTMLParser):
    SELF_CLOSING = {'br', 'img', 'hr', 'input', 'meta', 'link'}

    def __init__(self):
        super().__init__()
        self.tags = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() not in self.SELF_CLOSING:
            self.tags.append(tag.lower())

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in self.SELF_CLOSING:
            return
        if not self.tags:
            self.errors.append(f"Unexpected closing tag: </{tag}>")
            return
        last_tag = self.tags.pop()
        if last_tag != tag:
            self.errors.append(f"Mismatched tag: expected </{last_tag}>, got </{tag}>")

    def validate(self, html):
        self.tags = []
        self.errors = []
        self.feed(html)
        while self.tags:
            self.errors.append(f"Unclosed tag: <{self.tags.pop()}>")
        return self.errors

def build_deck(config_path):
    with open(config_path, 'r') as f:
        config = json.load(f)

    base_dir = os.path.dirname(os.path.abspath(config_path))
    
    # Load Core
    with open(os.path.join(base_dir, 'core/engine.js'), 'r') as f:
        engine_js = f.read()
    with open(os.path.join(base_dir, 'core/base_styles.css'), 'r') as f:
        base_styles = f.read()

    # Load Theme
    theme_name = config.get('theme', 'default')
    theme_vars_path = os.path.join(base_dir, f'themes/{theme_name}/variables.css')
    if os.path.exists(theme_vars_path):
        with open(theme_vars_path, 'r') as f:
            theme_vars = f.read()
    else:
        theme_vars = "/* Theme variables not found */"

    # Load Template
    template_name = config.get('template', 'default.html')
    with open(os.path.join(base_dir, f'templates/{template_name}'), 'r') as f:
        template = f.read()

    # Assemble Slides
    slides_html = []
    linter = SlideLinter()
    
    for slide_cfg in config.get('slides', []):
        file_path = os.path.join(base_dir, 'slides', slide_cfg['file'])
        with open(file_path, 'r') as f:
            raw_content = f.read()

        # Extract front-matter
        meta = {}
        content = raw_content
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                for line in parts[1].strip().split('\n'):
                    if ':' in line:
                        k, v = line.split(':', 1)
                        meta[k.strip()] = v.strip()
                content = parts[2].strip()

        # Convert Markdown if needed
        if file_path.endswith('.md'):
            content = SimpleMarkdown.to_html(content)

        # Slide Attributes
        classes = ["sd-slide"]
        if meta.get('layout'): classes.append(meta['layout'])
        
        attrs = f'class="{" ".join(classes)}"'
        if meta.get('transition'):
            attrs += f' data-transition="{meta["transition"]}"'

        slide_html = f'<section {attrs}>\n{content}\n</section>'
        
        # Lint
        errors = linter.validate(slide_html)
        if errors:
            print(f"Warning: Lint errors in {slide_cfg['file']}:")
            for err in errors: print(f"  - {err}")
            
        slides_html.append(slide_html)

    # Final Assembly
    output = template.replace('{{TITLE}}', config.get('title', 'Presentation'))
    output = output.replace('{{THEME_VARIABLES}}', theme_vars)
    output = output.replace('{{BASE_STYLES}}', base_styles)
    output = output.replace('{{CUSTOM_STYLES}}', config.get('custom_styles', ''))
    output = output.replace('{{SLIDES}}', '\n'.join(slides_html))
    output = output.replace('{{ENGINE_JS}}', engine_js)

    output_path = os.path.join(base_dir, config.get('output', 'slideshow.html'))
    with open(output_path, 'w') as f:
        f.write(output)
    
    print(f"Successfully built deck: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SlideDown Deck Tool")
    parser.add_argument("command", choices=["build"], help="Command to run")
    parser.add_argument("--config", default="deck.json", help="Path to config file")
    
    args = parser.parse_args()
    
    if args.command == "build":
        build_deck(args.config)
