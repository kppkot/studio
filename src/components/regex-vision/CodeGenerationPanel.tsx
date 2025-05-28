"use client";
import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { LANGUAGES } from './constants';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeGenerationPanelProps {
  generatedRegex: string;
  regexFlags: string;
  testText: string;
}

const CodeGenerationPanel: React.FC<CodeGenerationPanelProps> = ({ generatedRegex, regexFlags, testText }) => {
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].id);
  const { toast } = useToast();

  const generateCodeSnippet = () => {
    const escapedRegex = generatedRegex.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedTestText = testText.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

    switch (selectedLanguage) {
      case 'javascript':
        return `// JavaScript
const regex = /${generatedRegex}/${regexFlags};
const text = "${escapedTestText}";
const matches = [];
let match;
while ((match = regex.exec(text)) !== null) {
  matches.push(match);
}
console.log(matches);
// For all matches (alternative):
// const allMatches = text.matchAll(regex);
// for (const m of allMatches) { console.log(m); }`;

      case 'python':
        let pyFlags = '';
        if (regexFlags.includes('i')) pyFlags += 're.IGNORECASE';
        if (regexFlags.includes('m')) pyFlags = (pyFlags ? pyFlags + ' | ' : '') + 're.MULTILINE';
        if (regexFlags.includes('s')) pyFlags = (pyFlags ? pyFlags + ' | ' : '') + 're.DOTALL';
        // Python does not have a direct equivalent for 'g' in finditer/findall
        // 'g' is default for re.findall and re.finditer
        return `# Python
import re

pattern = r"${escapedRegex}"
text = "${escapedTestText}"
flags = ${pyFlags || 0}

# Find all non-overlapping matches
all_matches = re.findall(pattern, text, flags=flags)
print("findall matches:", all_matches)

# For more detailed match objects (including groups)
for match_obj in re.finditer(pattern, text, flags=flags):
    print("Match object:", match_obj.group(0), "Groups:", match_obj.groups())`;

      case 'php':
        return `<?php
// PHP
$pattern = '/${escapedRegex}/${regexFlags}';
$text = "${escapedTestText}";
if (preg_match_all($pattern, $text, $matches, PREG_SET_ORDER)) {
    print_r($matches);
} else {
    echo "No matches found.";
}`;

      case 'java':
        let javaFlags = "";
        if (regexFlags.includes('i')) javaFlags += "Pattern.CASE_INSENSITIVE";
        if (regexFlags.includes('m')) javaFlags = (javaFlags.length > 0 ? javaFlags + " | " : "") + "Pattern.MULTILINE";
        if (regexFlags.includes('s')) javaFlags = (javaFlags.length > 0 ? javaFlags + " | " : "") + "Pattern.DOTALL";
        if (regexFlags.includes('u')) javaFlags = (javaFlags.length > 0 ? javaFlags + " | " : "") + "Pattern.UNICODE_CASE"; // Or UNICODE_CHARACTER_CLASS

        return `// Java
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.ArrayList;
import java.util.List;

public class RegexTest {
    public static void main(String[] args) {
        String regex = "${escapedRegex}";
        String text = "${escapedTestText}";
        Pattern pattern = Pattern.compile(regex${javaFlags.length > 0 ? ", " + javaFlags : ""});
        Matcher matcher = pattern.matcher(text);

        // Find all matches
        List<String> allMatches = new ArrayList<>();
        while (matcher.find()) {
            allMatches.add(matcher.group(0)); // group(0) is the whole match
            // For groups:
            // for (int i = 1; i <= matcher.groupCount(); i++) {
            //     System.out.println("Group " + i + ": " + matcher.group(i));
            // }
        }
        System.out.println(allMatches);
    }
}`;
      case 'csharp':
        let csOptions = "RegexOptions.None";
        if (regexFlags.includes('i')) csOptions = (csOptions === "RegexOptions.None" ? "" : csOptions + " | ") + "RegexOptions.IgnoreCase";
        if (regexFlags.includes('m')) csOptions = (csOptions === "RegexOptions.None" ? "" : csOptions + " | ") + "RegexOptions.Multiline";
        if (regexFlags.includes('s')) csOptions = (csOptions === "RegexOptions.None" ? "" : csOptions + " | ") + "RegexOptions.Singleline";
        
        return `// C#
using System;
using System.Text.RegularExpressions;
using System.Collections.Generic;

public class Example
{
    public static void Main(string[] args)
    {
        string pattern = @"${generatedRegex.replace(/"/g, '""')}"; // Verbatim string, escape quotes by doubling
        string text = @"${testText.replace(/"/g, '""')}";
        RegexOptions options = ${csOptions};
        
        MatchCollection matches = Regex.Matches(text, pattern, options);
        
        Console.WriteLine($"Found {matches.Count} matches:");
        foreach (Match match in matches)
        {
            Console.WriteLine($"Match: {match.Value} at index {match.Index}");
            // For groups:
            // for (int i = 1; i < match.Groups.Count; i++) { // Group 0 is the whole match
            //    Console.WriteLine($"  Group {i}: {match.Groups[i].Value}");
            // }
        }
    }
}`;
      default:
        return 'Select a language to see the code snippet.';
    }
  };

  const codeSnippet = generateCodeSnippet();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeSnippet)
      .then(() => {
        toast({ title: "Success", description: "Code snippet copied!" });
      })
      .catch(err => {
        toast({ title: "Error", description: "Failed to copy code.", variant: "destructive" });
        console.error('Failed to copy code: ', err);
      });
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="languageSelect" className="text-sm font-medium">Language</Label>
        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
          <SelectTrigger id="languageSelect" className="w-[180px] h-9">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(lang => (
              <SelectItem key={lang.id} value={lang.id}>{lang.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="relative flex-1 min-h-0">
        <ScrollArea className="h-full w-full rounded-md border bg-muted/40">
          <pre className="p-4 text-xs font-mono">
            <code>{codeSnippet}</code>
          </pre>
        </ScrollArea>
        <Button
            variant="secondary"
            size="icon"
            onClick={handleCopyCode}
            title="Copy Code"
            className="absolute top-2 right-2 h-7 w-7"
            disabled={!generatedRegex}
          >
          <Copy size={14} />
        </Button>
      </div>
    </div>
  );
};

export default CodeGenerationPanel;
