#!/usr/bin/env python3
import re

with open('/Users/amits4/Desktop/moveassist/backend/public/index.html', 'r') as f:
    content = f.read()
    
# Find script content
script_match = re.search(r'<script>(.*?)</script>', content, re.DOTALL)
if not script_match:
    print('No script found')
    exit(1)
    
script = script_match.group(1)
lines = script.split('\n')

# Track where we have opening function but might be missing closing
in_function = None
balance = 0
function_stack = []

for i, line in enumerate(lines, 1):
    # Track function starts
    if 'function ' in line and '{' in line:
        function_stack.append((i, line.strip()[:60]))
    
    # Count braces
    for char in line:
        if char == '{':
            balance += 1
        elif char == '}':
            balance -= 1
            
    # Check if we closed a function
    if balance == 0 and function_stack:
        func = function_stack.pop()
        
# Print remaining unclosed functions
if function_stack:
    print("Unclosed functions:")
    for line_num, func_line in function_stack:
        print(f"  Line {line_num}: {func_line}")

print(f"\nFinal balance: {balance}")
if balance < 0:
    print(f"ERROR: {abs(balance)} extra closing brace(s)")
elif balance > 0:
    print(f"ERROR: {balance} unclosed opening brace(s)")
