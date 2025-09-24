#!/bin/bash

# XRAI Git Worktree Management Script
# This script helps manage git worktrees for the XRAI workspace
# allowing parallel development across different features/branches

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default worktree directory
WORKTREE_BASE="${HOME}/Desktop/XRAI-worktrees"

# Function to display usage
usage() {
    echo "XRAI Git Worktree Manager"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  init                    Initialize git repository if not already initialized"
    echo "  list                    List all worktrees"
    echo "  add <branch> [path]     Add a new worktree for branch"
    echo "  remove <worktree>       Remove a worktree"
    echo "  switch <worktree>       Switch to a worktree directory"
    echo "  clone <repo> [branch]   Clone repo and setup worktree"
    echo "  status                  Show status of all worktrees"
    echo "  clean                   Remove all worktrees (keeps main repo)"
    echo ""
    echo "Examples:"
    echo "  $0 init                          # Initialize current directory as git repo"
    echo "  $0 add feature/ai-mcp            # Create worktree for feature/ai-mcp"
    echo "  $0 add hotfix/bug-123 ../fixes  # Create worktree in custom location"
    echo "  $0 switch feature/ai-mcp         # Change to worktree directory"
    echo "  $0 clone https://github.com/user/xrai.git main"
}

# Function to check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}Error: Not in a git repository${NC}"
        echo -e "${YELLOW}Run '$0 init' to initialize or '$0 clone' to clone a repository${NC}"
        return 1
    fi
    return 0
}

# Initialize git repository
init_repo() {
    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${YELLOW}Already in a git repository${NC}"
        git remote -v
    else
        echo -e "${BLUE}Initializing git repository...${NC}"
        git init
        echo -e "${GREEN}Git repository initialized${NC}"
        echo ""
        echo -e "${YELLOW}Next steps:${NC}"
        echo "1. Add remote: git remote add origin <repository-url>"
        echo "2. Create initial commit: git add . && git commit -m 'Initial commit'"
        echo "3. Push to remote: git push -u origin main"
    fi
}

# Clone repository and setup worktree environment
clone_repo() {
    local repo_url=$1
    local default_branch=${2:-main}
    
    if [[ -z "$repo_url" ]]; then
        echo -e "${RED}Error: Repository URL required${NC}"
        echo "Usage: $0 clone <repository-url> [default-branch]"
        return 1
    fi
    
    # Extract repo name from URL
    local repo_name=$(basename "$repo_url" .git)
    local clone_dir="${HOME}/Desktop/${repo_name}"
    
    echo -e "${BLUE}Cloning repository: $repo_url${NC}"
    echo -e "${BLUE}Into directory: $clone_dir${NC}"
    
    if [[ -d "$clone_dir" ]]; then
        echo -e "${RED}Error: Directory $clone_dir already exists${NC}"
        return 1
    fi
    
    git clone "$repo_url" "$clone_dir"
    cd "$clone_dir"
    
    echo -e "${GREEN}Repository cloned successfully${NC}"
    echo -e "${BLUE}Setting up worktree base directory...${NC}"
    
    WORKTREE_BASE="${HOME}/Desktop/${repo_name}-worktrees"
    mkdir -p "$WORKTREE_BASE"
    
    echo -e "${GREEN}Worktree base created at: $WORKTREE_BASE${NC}"
}

# List all worktrees
list_worktrees() {
    check_git_repo || return 1
    
    echo -e "${BLUE}Git Worktrees:${NC}"
    git worktree list
}

# Add a new worktree
add_worktree() {
    check_git_repo || return 1
    
    local branch=$1
    local path=$2
    
    if [[ -z "$branch" ]]; then
        echo -e "${RED}Error: Branch name required${NC}"
        echo "Usage: $0 add <branch-name> [path]"
        return 1
    fi
    
    # Use default path if not specified
    if [[ -z "$path" ]]; then
        mkdir -p "$WORKTREE_BASE"
        path="$WORKTREE_BASE/$branch"
    fi
    
    # Check if branch exists
    if git show-ref --verify --quiet "refs/heads/$branch"; then
        echo -e "${BLUE}Creating worktree for existing branch: $branch${NC}"
        git worktree add "$path" "$branch"
    else
        echo -e "${BLUE}Creating worktree with new branch: $branch${NC}"
        git worktree add -b "$branch" "$path"
    fi
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Worktree created successfully at: $path${NC}"
        echo ""
        echo -e "${YELLOW}To switch to this worktree, run:${NC}"
        echo "cd $path"
        echo "# or"
        echo "$0 switch $branch"
    else
        echo -e "${RED}Failed to create worktree${NC}"
        return 1
    fi
}

# Remove a worktree
remove_worktree() {
    check_git_repo || return 1
    
    local worktree=$1
    
    if [[ -z "$worktree" ]]; then
        echo -e "${RED}Error: Worktree name or path required${NC}"
        echo "Usage: $0 remove <worktree-name-or-path>"
        return 1
    fi
    
    # Try to find worktree path if name is given
    local worktree_path
    if [[ -d "$worktree" ]]; then
        worktree_path="$worktree"
    else
        worktree_path="$WORKTREE_BASE/$worktree"
    fi
    
    echo -e "${YELLOW}Removing worktree: $worktree_path${NC}"
    git worktree remove "$worktree_path"
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Worktree removed successfully${NC}"
    else
        echo -e "${RED}Failed to remove worktree${NC}"
        echo -e "${YELLOW}You may need to use --force if there are uncommitted changes${NC}"
    fi
}

# Switch to a worktree directory
switch_worktree() {
    check_git_repo || return 1
    
    local worktree=$1
    
    if [[ -z "$worktree" ]]; then
        echo -e "${RED}Error: Worktree name required${NC}"
        echo "Usage: $0 switch <worktree-name>"
        return 1
    fi
    
    local worktree_path="$WORKTREE_BASE/$worktree"
    
    if [[ -d "$worktree_path" ]]; then
        echo -e "${GREEN}Switching to worktree: $worktree_path${NC}"
        cd "$worktree_path"
        exec $SHELL
    else
        echo -e "${RED}Error: Worktree not found at $worktree_path${NC}"
        echo -e "${YELLOW}Available worktrees:${NC}"
        git worktree list
    fi
}

# Show status of all worktrees
status_all_worktrees() {
    check_git_repo || return 1
    
    echo -e "${BLUE}Status of all worktrees:${NC}"
    echo ""
    
    git worktree list | while read -r line; do
        local path=$(echo "$line" | awk '{print $1}')
        local branch=$(echo "$line" | awk '{print $3}' | tr -d '[]')
        
        echo -e "${GREEN}Worktree: $path${NC}"
        echo -e "${YELLOW}Branch: $branch${NC}"
        
        if [[ -d "$path" ]]; then
            cd "$path"
            git status -s
            if [[ -z $(git status -s) ]]; then
                echo "  Working tree clean"
            fi
        else
            echo -e "${RED}  Directory not found${NC}"
        fi
        echo ""
    done
}

# Clean all worktrees (remove all except main repository)
clean_worktrees() {
    check_git_repo || return 1
    
    echo -e "${YELLOW}This will remove all worktrees except the main repository.${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git worktree list | grep -v "(bare)" | tail -n +2 | while read -r line; do
            local path=$(echo "$line" | awk '{print $1}')
            echo -e "${YELLOW}Removing worktree: $path${NC}"
            git worktree remove "$path" --force
        done
        echo -e "${GREEN}All worktrees cleaned${NC}"
    else
        echo -e "${BLUE}Clean cancelled${NC}"
    fi
}

# Main script logic
case "$1" in
    init)
        init_repo
        ;;
    list)
        list_worktrees
        ;;
    add)
        add_worktree "$2" "$3"
        ;;
    remove|rm)
        remove_worktree "$2"
        ;;
    switch|cd)
        switch_worktree "$2"
        ;;
    clone)
        clone_repo "$2" "$3"
        ;;
    status)
        status_all_worktrees
        ;;
    clean)
        clean_worktrees
        ;;
    *)
        usage
        ;;
esac