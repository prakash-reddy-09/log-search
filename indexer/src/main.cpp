// logindex: a tiny inverted-indexer tool for log files
//
// logindex build <logfile> <prefix>
//      Reads log file, writes <prefix>.idx (word -> linenumbers)
//      and <prefix>.off (byte offset of every line, binary)
//
//  logindex build <logfile> <prefix> <limit> <term> [term...]
//      Prints "TOTAL<TAB>n" and then up to <limit> lines of the form
//      "<lineNumber><TAB><text>" for lines containing ALL terms.
//      Line numbers are 1-based.


#include <algorithm>
#include <cctype>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>
#include <set>

namespace {

using Postings = std::vector<std::uint32_t>;

std::vector<std::string> tokenize(const std::string& text)
{
    std::vector<std::string> tokens;
    std::string current;
    for(unsigned char c: text)
    {
        if(std::isalnum(c) || c == '_')
        {
            current.push_back(static_cast<char>(std::tolower(c)));
        } else if(!current.empty()) {
                tokens.push_back(current);
                current.clear();    
            }
    }

    if(!current.empty()) tokens.push_back(current);
    return tokens;
}

int build(const std::string& logPath, const std::string& prefix)
{
    std::ifstream in(logPath, std::ios::binary);
    if(!in)
    {
        std::cerr << "cannot open log file: " << logPath << "\n";
        return 1;
    }
    
    std::ofstream offsets(prefix + ".off" , std::ios::binary);
    if(!offsets)
    {
        std::cerr << "cannot write offsets file\n";
        return 1;
    }

    std::unordered_map<std::string, Postings> index;
    std::string line;
    std::uint64_t offset = 0;
    std::uint32_t lineId = 0;

    while(std::getline(in, line))
    {
        offsets.write(reinterpret_cast<const char*>(&offset), sizeof(offset));

        auto tokens = tokenize(line);
        std::sort(tokens.begin(), tokens.end());
        tokens.erase(std::unique(tokens.begin(), tokens.end()), tokens.end());
        for(const auto& token: tokens) index[token].push_back(lineId);

        offset += line.size() + 1;
        ++lineId;
    }
    offsets.close();

    std::ofstream idx(prefix + ".idx", std::ios::binary);
    if(!idx)
    {
        std::cerr << "cannot write index file\n";
        return 1;
    }

    for(const auto& [term, ids]: index)
    {
        idx << term << '\t';
        for(std::size_t i = 0; i < ids.size(); ++i)
        {
            if (i > 0) idx << ',';
            idx << ids[i];
        }
        idx << '\n';
    }
    
    std::cout << "lines=" << lineId << " terms=" << index.size() << "\n";
    return 0;
}

int search(const std::string& logPath, const std::string& prefix, std::size_t limit, std::vector<std::string>& queryArgs)
{
    std::set<std::string, std::less<>> terms;
    for(const auto& arg: queryArgs)
    {
        for (auto& t : tokenize(arg)) terms.insert(std::move(t));
    }

    if (terms.empty())
    {
        std::cout << "TOTAL\t0\n";
    }

    std::ifstream idx(prefix + ".idx", std::ios::binary);
    if(!idx)
    {
        std::cerr << "cannot open index file (was the log indexed?)\n";
        return 1;
    }

    std::unordered_map<std::string, Postings> found;
    std::string row;
    while(found.size() < terms.size() && std::getline(idx, row))
    {
        const auto tab = row.find('\t');
        if(tab == std::string::npos) continue;
        std::string_view key(row.data(), tab);
        auto it = terms.find(key);
        if(it == terms.end()) continue;

        Postings ids;
        std::uint32_t current = 0;
        for(std::size_t i = tab + 1; i < row.size(); ++i)
        {
            if(row[i] == ',')
            {
                ids.push_back(current);
                current = 0;
            } else {
                current = current * 10 + static_cast<std::uint32_t>(row[i] - '0');
            }
        }

        ids.push_back(current);
        found.emplace(*it, std::move(ids));
    }

    if(found.size() < terms.size())
    {
        std::cout << "TOTAL\t0\n";
        return 0;
    }

    return 0;
}

void usage()
{
    std::cerr << "usage: \n"
                 "  logindex build <logfile> <prefix>\n"
                 "  logindex search <logfile> <prefix> <limit> <term> [term...]\n]";
}

}

int main(int argc, char** argv)
{
    if(argc >= 4 && std::string(argv[1]) == "build")
    {
        return build(argv[2], argv[3]);
    }

    if(argc >= 6 && std::string(argv[1]) == "search")
    {
        std::size_t limit = 0;
        try{
            limit = std::stoul(argv[4]);
        } catch(...) {
            usage();
            return 2;
        }
        std::vector<std::string> query(argv + 5, argv + argc);
        return search(argv[2], argv[3], limit, query);
    }

    usage();
    return 2;
}
