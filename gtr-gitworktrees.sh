#!/bin/bash

# GTR - Git Tree Enhanced Worktree Management System
# Optimized for parallel development workflows with Claude Code
# Based on best practices for efficient git worktree usage

set -euo pipefail

# Configuration
SCRIPT_VERSION="1.0.0"
WORKTREE_DIR=".worktrees"
CONFIG_FILE=".worktreerc"
DEFAULT_EDITOR="${EDITOR:-code}"
DEFAULT_REMOTE="origin"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Icons
ICON_SUCCESS="✓"
ICON_ERROR="✗"
ICON_WARNING="⚠"
ICON_INFO="ℹ"
ICON_BRANCH="⎇"
ICON_CLEAN="✨"
ICON_DIRTY="●"
ICON_AHEAD="↑"
ICON_BEHIND="↓"
ICON_DIVERGED="↕"

# Get git root directory
get_git_root() {
    git rev-parse --show-toplevel 2>/dev/null || {
        echo ""
        return 1
    }
}

# Get worktree base directory
get_worktree_base() {
    local git_root
    git_root=$(get_git_root) || return 1
    echo "${git_root}/${WORKTREE_DIR}"
}

# Print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Print status message
print_status() {
    local type=$1
    local message=$2
    
    case $type in
        success)
            print_color "$GREEN" "${ICON_SUCCESS} ${message}"
            ;;
        error)
            print_color "$RED" "${ICON_ERROR} ${message}"
            ;;
        warning)
            print_color "$YELLOW" "${ICON_WARNING} ${message}"
            ;;
        info)
            print_color "$BLUE" "${ICON_INFO} ${message}"
            ;;
    esac
}

# Check if in git repository
check_git_repo() {
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        print_status error "Not in a git repository"
        print_status info "Run 'gtr init' to initialize a new repository"
        return 1
    fi
}

# Load configuration
load_config() {
    local git_root
    git_root=$(get_git_root) || return 1
    local config_path="${git_root}/${CONFIG_FILE}"
    
    if [[ -f "$config_path" ]]; then
        source "$config_path"
    fi
}

# Save configuration
save_config() {
    local git_root
    git_root=$(get_git_root) || return 1
    local config_path="${git_root}/${CONFIG_FILE}"
    
    cat > "$config_path" <<EOF
# GTR Worktree Configuration
# Generated on $(date)

# Default editor for opening worktrees
DEFAULT_EDITOR="${DEFAULT_EDITOR}"

# Default remote repository
DEFAULT_REMOTE="${DEFAULT_REMOTE}"

# Auto-prune merged branches
AUTO_PRUNE_MERGED=true

# Auto-fetch interval (minutes, 0 to disable)
AUTO_FETCH_INTERVAL=30

# Keep worktrees for recently merged branches (days)
KEEP_MERGED_DAYS=7

# IDE command (override default editor)
IDE_COMMAND="${IDE_COMMAND:-}"

# Custom worktree naming pattern
# Available vars: {branch}, {date}, {ticket}
WORKTREE_NAMING_PATTERN="{branch}"
EOF
}

# Initialize repository for worktrees
init_repository() {
    local current_dir=$(pwd)
    local repo_name=$(basename "$current_dir")
    
    if git rev-parse --git-dir >/dev/null 2>&1; then
        print_status warning "Already in a git repository"
        
        # Check if it's already a bare repo
        if git rev-parse --is-bare-repository 2>/dev/null | grep -q true; then
            print_status info "Repository is already bare"
            setup_worktree_structure
            return 0
        fi
        
        # Offer to convert to worktree structure
        print_status info "Would you like to convert this repository to use worktrees? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            convert_to_worktree_structure
        fi
    else
        # Initialize new repository
        print_status info "Initializing new git repository with worktree structure..."
        
        # Initialize as normal repository first
        git init
        
        # Set default branch to main
        git branch -m main
        
        setup_worktree_structure
        
        print_status success "Git repository initialized with worktree support"
        print_status info "Next steps:"
        echo "  1. Add remote: git remote add origin <url>"
        echo "  2. Create first worktree: gtr new main"
        echo "  3. Make initial commit in main worktree"
    fi
}

# Convert existing repo to worktree structure
convert_to_worktree_structure() {
    local git_root
    git_root=$(get_git_root) || return 1
    local current_branch=$(git branch --show-current)
    
    print_status info "Converting repository to worktree structure..."
    
    # Check for uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_status error "You have uncommitted changes. Please commit or stash them first."
        return 1
    fi
    
    # Create temporary directory for conversion
    local temp_dir=$(mktemp -d)
    
    # Move current working files to temp
    print_status info "Backing up current working directory..."
    rsync -av --exclude='.git' --exclude="${WORKTREE_DIR}" . "$temp_dir/"
    
    # Convert to bare repository
    mv .git .git.backup
    git clone --bare .git.backup .git
    rm -rf .git.backup
    
    # Clean working directory
    find . -mindepth 1 -maxdepth 1 -not -name '.git*' -exec rm -rf {} \;
    
    # Set up worktree structure
    setup_worktree_structure
    
    # Create worktree for current branch
    local worktree_path="${git_root}/${WORKTREE_DIR}/${current_branch}"
    git worktree add "$worktree_path" "$current_branch"
    
    # Restore files to worktree
    print_status info "Restoring files to worktree..."
    rsync -av "$temp_dir/" "$worktree_path/"
    
    # Clean up
    rm -rf "$temp_dir"
    
    print_status success "Repository converted to worktree structure"
    print_status info "Your work is now in: ${worktree_path}"
    echo "Run 'gtr switch ${current_branch}' to go to your worktree"
}

# Set up worktree directory structure
setup_worktree_structure() {
    local git_root
    git_root=$(get_git_root) || return 1
    local worktree_base="${git_root}/${WORKTREE_DIR}"
    
    # Create worktree directory
    mkdir -p "$worktree_base"
    
    # Update .gitignore
    local gitignore="${git_root}/.gitignore"
    if ! grep -q "^${WORKTREE_DIR}/$" "$gitignore" 2>/dev/null; then
        echo -e "\n# Worktrees\n${WORKTREE_DIR}/" >> "$gitignore"
        print_status info "Added ${WORKTREE_DIR}/ to .gitignore"
    fi
    
    # Create default configuration
    if [[ ! -f "${git_root}/${CONFIG_FILE}" ]]; then
        save_config
        print_status info "Created ${CONFIG_FILE}"
    fi
    
    # Create .git/info/exclude for local ignores
    local exclude_file="${git_root}/.git/info/exclude"
    mkdir -p "$(dirname "$exclude_file")"
    if ! grep -q "^${CONFIG_FILE}$" "$exclude_file" 2>/dev/null; then
        echo -e "\n# Local worktree config\n${CONFIG_FILE}" >> "$exclude_file"
    fi
}

# Create new worktree
create_worktree() {
    check_git_repo || return 1
    
    local branch_name=$1
    local base_branch=${2:-$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@' 2>/dev/null || echo "main")}
    
    if [[ -z "$branch_name" ]]; then
        # Interactive branch name input
        print_status info "Enter branch name (e.g., feature/awesome-feature):"
        read -r branch_name
        
        if [[ -z "$branch_name" ]]; then
            print_status error "Branch name is required"
            return 1
        fi
    fi
    
    local git_root
    git_root=$(get_git_root) || return 1
    local worktree_path="${git_root}/${WORKTREE_DIR}/${branch_name//\//-}"
    
    # Check if worktree already exists
    if [[ -d "$worktree_path" ]]; then
        print_status error "Worktree already exists: ${worktree_path}"
        return 1
    fi
    
    # Check if branch exists
    if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
        # Branch exists locally
        print_status info "Creating worktree for existing branch: ${branch_name}"
        git worktree add "$worktree_path" "$branch_name"
    elif git show-ref --verify --quiet "refs/remotes/origin/${branch_name}"; then
        # Branch exists on remote
        print_status info "Creating worktree for remote branch: origin/${branch_name}"
        git worktree add "$worktree_path" -b "$branch_name" "origin/${branch_name}"
    else
        # Create new branch
        print_status info "Creating new branch '${branch_name}' from '${base_branch}'"
        
        # Ensure we have the latest base branch
        git fetch origin "${base_branch}:refs/remotes/origin/${base_branch}" 2>/dev/null || true
        
        # Create worktree with new branch
        if git show-ref --verify --quiet "refs/remotes/origin/${base_branch}"; then
            git worktree add "$worktree_path" -b "$branch_name" "origin/${base_branch}"
        else
            git worktree add "$worktree_path" -b "$branch_name" "$base_branch"
        fi
    fi
    
    if [[ $? -eq 0 ]]; then
        print_status success "Worktree created at: ${worktree_path}"
        
        # Copy common files if they exist
        copy_common_files "$worktree_path"
        
        # Offer to switch to new worktree
        print_status info "Switch to new worktree? (Y/n)"
        read -r response
        if [[ ! "$response" =~ ^[Nn]$ ]]; then
            switch_worktree "$branch_name"
        fi
    else
        print_status error "Failed to create worktree"
        return 1
    fi
}

# Copy common files to new worktree
copy_common_files() {
    local worktree_path=$1
    local git_root
    git_root=$(get_git_root) || return 1
    
    # List of files to copy if they exist
    local files_to_copy=(
        ".env.local"
        ".env.development.local"
        "node_modules"
    )
    
    for file in "${files_to_copy[@]}"; do
        local source="${git_root}/${WORKTREE_DIR}/main/${file}"
        if [[ -e "$source" ]]; then
            print_status info "Copying ${file} to new worktree..."
            cp -r "$source" "${worktree_path}/"
        fi
    done
}

# List all worktrees with enhanced information
list_worktrees() {
    check_git_repo || return 1
    
    print_color "$CYAN" "Git Worktrees:"
    echo ""
    
    local current_dir=$(pwd)
    local format_string="%-30s %-20s %-10s %s\n"
    
    # Header
    printf "${WHITE}${format_string}${NC}" "PATH" "BRANCH" "STATUS" "DETAILS"
    printf "${WHITE}%s${NC}\n" "$(printf '%.0s-' {1..80})"
    
    # Process each worktree
    git worktree list --porcelain | while read -r line; do
        if [[ "$line" =~ ^worktree ]]; then
            local path=${line#worktree }
            
            # Read additional info
            read -r head_line
            read -r branch_line
            
            local branch=${branch_line#branch refs/heads/}
            
            # Skip if not a real worktree
            [[ "$branch" == "detached" ]] && continue
            
            # Get status
            if [[ -d "$path" ]]; then
                cd "$path" 2>/dev/null || continue
                
                local status_icon="${ICON_CLEAN}"
                local status_color="${GREEN}"
                local details=""
                
                # Check for uncommitted changes
                if ! git diff --quiet || ! git diff --cached --quiet; then
                    status_icon="${ICON_DIRTY}"
                    status_color="${YELLOW}"
                    local changes=$(git status --porcelain | wc -l | tr -d ' ')
                    details="${changes} changes"
                fi
                
                # Check for unpushed commits
                local ahead_behind=$(git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0 0")
                local ahead=$(echo "$ahead_behind" | cut -f1)
                local behind=$(echo "$ahead_behind" | cut -f2)
                
                if [[ "$ahead" -gt 0 ]] && [[ "$behind" -gt 0 ]]; then
                    details="${details:+$details, }${ICON_DIVERGED} ${ahead}↑ ${behind}↓"
                elif [[ "$ahead" -gt 0 ]]; then
                    details="${details:+$details, }${ICON_AHEAD} ${ahead} ahead"
                elif [[ "$behind" -gt 0 ]]; then
                    details="${details:+$details, }${ICON_BEHIND} ${behind} behind"
                fi
                
                # Mark current worktree
                local path_display="$path"
                if [[ "$path" == "$current_dir" ]]; then
                    path_display="● ${path}"
                fi
                
                # Format output
                printf "${format_string}" \
                    "$(print_color "$BLUE" "$path_display")" \
                    "$(print_color "$MAGENTA" "${ICON_BRANCH} $branch")" \
                    "$(print_color "$status_color" "$status_icon")" \
                    "$details"
                
                cd - >/dev/null
            else
                # Worktree directory missing
                printf "${format_string}" \
                    "$(print_color "$RED" "$path")" \
                    "$(print_color "$MAGENTA" "${ICON_BRANCH} $branch")" \
                    "$(print_color "$RED" "${ICON_ERROR}")" \
                    "Directory missing"
            fi
        fi
    done
    
    echo ""
    
    # Summary
    local total=$(git worktree list | wc -l | tr -d ' ')
    print_status info "Total worktrees: ${total}"
}

# Switch to worktree
switch_worktree() {
    check_git_repo || return 1
    
    local branch_name=$1
    
    if [[ -z "$branch_name" ]]; then
        # Interactive selection
        print_status info "Select worktree to switch to:"
        
        local worktrees=()
        while IFS= read -r line; do
            if [[ "$line" =~ ^worktree ]]; then
                local path=${line#worktree }
                read -r head_line
                read -r branch_line
                local branch=${branch_line#branch refs/heads/}
                
                if [[ "$branch" != "detached" ]]; then
                    worktrees+=("$branch:$path")
                fi
            fi
        done < <(git worktree list --porcelain)
        
        if [[ ${#worktrees[@]} -eq 0 ]]; then
            print_status error "No worktrees found"
            return 1
        fi
        
        # Display menu
        local i=1
        for worktree in "${worktrees[@]}"; do
            local branch=${worktree%%:*}
            local path=${worktree#*:}
            printf "%2d) %-30s %s\n" "$i" "$branch" "$path"
            ((i++))
        done
        
        echo -n "Enter number: "
        read -r selection
        
        if [[ "$selection" =~ ^[0-9]+$ ]] && [[ "$selection" -ge 1 ]] && [[ "$selection" -le ${#worktrees[@]} ]]; then
            local selected=${worktrees[$((selection-1))]}
            branch_name=${selected%%:*}
        else
            print_status error "Invalid selection"
            return 1
        fi
    fi
    
    # Find worktree path
    local worktree_path
    git worktree list --porcelain | while read -r line; do
        if [[ "$line" =~ ^worktree ]]; then
            local path=${line#worktree }
            read -r head_line
            read -r branch_line
            local branch=${branch_line#branch refs/heads/}
            
            if [[ "$branch" == "$branch_name" ]] || [[ "$(basename "$path")" == "${branch_name//\//-}" ]]; then
                worktree_path="$path"
                break
            fi
        fi
    done
    
    if [[ -n "$worktree_path" ]] && [[ -d "$worktree_path" ]]; then
        print_status success "Switching to worktree: ${worktree_path}"
        cd "$worktree_path"
        exec $SHELL
    else
        print_status error "Worktree not found: ${branch_name}"
        return 1
    fi
}

# Update all worktrees
update_worktrees() {
    check_git_repo || return 1
    
    print_status info "Updating all worktrees..."
    
    # Fetch all remotes
    git fetch --all --prune
    
    local updated=0
    local failed=0
    
    git worktree list --porcelain | while read -r line; do
        if [[ "$line" =~ ^worktree ]]; then
            local path=${line#worktree }
            read -r head_line
            read -r branch_line
            local branch=${branch_line#branch refs/heads/}
            
            if [[ "$branch" != "detached" ]] && [[ -d "$path" ]]; then
                print_status info "Updating ${branch}..."
                
                cd "$path"
                
                # Check for uncommitted changes
                if ! git diff --quiet || ! git diff --cached --quiet; then
                    print_status warning "Skipping ${branch} - has uncommitted changes"
                else
                    # Try to fast-forward merge
                    if git merge --ff-only "origin/${branch}" 2>/dev/null; then
                        ((updated++))
                        print_status success "Updated ${branch}"
                    else
                        # Check if branch exists on remote
                        if git show-ref --verify --quiet "refs/remotes/origin/${branch}"; then
                            print_status warning "Cannot fast-forward ${branch} - manual merge required"
                        else
                            print_status info "No remote branch for ${branch}"
                        fi
                    fi
                fi
                
                cd - >/dev/null
            fi
        fi
    done
    
    echo ""
    print_status success "Update complete. ${updated} worktrees updated."
}

# Clean up worktrees
clean_worktrees() {
    check_git_repo || return 1
    
    print_status info "Cleaning up worktrees..."
    
    local removed=0
    
    # Remove worktrees for deleted branches
    git worktree list --porcelain | while read -r line; do
        if [[ "$line" =~ ^worktree ]]; then
            local path=${line#worktree }
            read -r head_line
            read -r branch_line
            local branch=${branch_line#branch refs/heads/}
            
            if [[ "$branch" != "detached" ]]; then
                # Check if branch still exists
                if ! git show-ref --verify --quiet "refs/heads/${branch}"; then
                    print_status warning "Branch ${branch} no longer exists"
                    
                    if [[ -d "$path" ]]; then
                        cd "$path"
                        if git diff --quiet && git diff --cached --quiet; then
                            cd - >/dev/null
                            print_status info "Removing worktree: ${path}"
                            git worktree remove "$path"
                            ((removed++))
                        else
                            cd - >/dev/null
                            print_status warning "Cannot remove ${path} - has uncommitted changes"
                        fi
                    else
                        # Directory already gone, just prune
                        git worktree prune
                        ((removed++))
                    fi
                fi
            fi
        fi
    done
    
    # Prune worktree metadata
    git worktree prune
    
    print_status success "Cleanup complete. ${removed} worktrees removed."
}

# Open worktree in editor
open_worktree() {
    check_git_repo || return 1
    
    local branch_name=$1
    
    # If no branch specified, use current
    if [[ -z "$branch_name" ]]; then
        branch_name=$(git branch --show-current)
    fi
    
    # Find worktree path
    local worktree_path
    git worktree list --porcelain | while read -r line; do
        if [[ "$line" =~ ^worktree ]]; then
            local path=${line#worktree }
            read -r head_line
            read -r branch_line
            local branch=${branch_line#branch refs/heads/}
            
            if [[ "$branch" == "$branch_name" ]]; then
                worktree_path="$path"
                break
            fi
        fi
    done
    
    if [[ -n "$worktree_path" ]] && [[ -d "$worktree_path" ]]; then
        local editor_command="${IDE_COMMAND:-$DEFAULT_EDITOR}"
        print_status info "Opening ${worktree_path} in ${editor_command}..."
        $editor_command "$worktree_path"
    else
        print_status error "Worktree not found: ${branch_name}"
        return 1
    fi
}

# Show comprehensive status
show_status() {
    check_git_repo || return 1
    
    local git_root
    git_root=$(get_git_root) || return 1
    
    print_color "$CYAN" "=== GTR Worktree Status ==="
    echo ""
    
    # Repository info
    print_color "$WHITE" "Repository Information:"
    echo "  Root: ${git_root}"
    echo "  Remote: $(git remote get-url origin 2>/dev/null || echo "No remote configured")"
    echo "  Default branch: $(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "Not set")"
    echo ""
    
    # Worktree summary
    local total=$(git worktree list | wc -l | tr -d ' ')
    local clean=0
    local dirty=0
    
    git worktree list --porcelain | while read -r line; do
        if [[ "$line" =~ ^worktree ]]; then
            local path=${line#worktree }
            if [[ -d "$path" ]]; then
                cd "$path"
                if git diff --quiet && git diff --cached --quiet; then
                    ((clean++))
                else
                    ((dirty++))
                fi
                cd - >/dev/null
            fi
        fi
    done 2>/dev/null
    
    print_color "$WHITE" "Worktree Summary:"
    echo "  Total: ${total}"
    echo "  Clean: ${clean}"
    echo "  Modified: ${dirty}"
    echo ""
    
    # Detailed worktree list
    list_worktrees
    
    # Disk usage
    if command -v du >/dev/null 2>&1; then
        local worktree_size=$(du -sh "${git_root}/${WORKTREE_DIR}" 2>/dev/null | cut -f1)
        print_color "$WHITE" "Disk Usage:"
        echo "  Worktrees: ${worktree_size:-N/A}"
        echo ""
    fi
}

# Show help
show_help() {
    cat <<EOF
GTR - Git Tree Enhanced Worktree Management System
Version: ${SCRIPT_VERSION}

USAGE:
    gtr <command> [arguments]

COMMANDS:
    init                    Initialize repository for worktree usage
    new <branch> [base]     Create new worktree (alias: add)
    list                    List all worktrees with status (alias: ls)
    switch <branch>         Switch to a worktree (alias: sw, cd)
    update                  Update all worktrees from remote
    clean                   Remove orphaned worktrees (alias: prune)
    status                  Show comprehensive status
    open [branch]           Open worktree in editor
    remove <branch>         Remove a specific worktree (alias: rm)
    help                    Show this help message

EXAMPLES:
    gtr init                      # Set up worktree structure
    gtr new feature/awesome       # Create new feature branch
    gtr new hotfix/urgent main    # Create hotfix from main
    gtr switch feature/awesome    # Switch to worktree
    gtr list                      # Show all worktrees
    gtr update                    # Update all worktrees
    gtr clean                     # Clean up old worktrees

CONFIGURATION:
    Configuration is stored in .worktreerc in the repository root.
    Edit this file to customize behavior.

TIPS:
    - Worktrees are stored in .worktrees/ directory
    - Each worktree is independent with its own working files
    - Use 'gtr switch' to quickly move between worktrees
    - Run 'gtr update' regularly to keep branches in sync

For more information: https://git-scm.com/docs/git-worktree
EOF
}

# Remove specific worktree
remove_worktree() {
    check_git_repo || return 1
    
    local branch_name=$1
    
    if [[ -z "$branch_name" ]]; then
        print_status error "Branch name required"
        echo "Usage: gtr remove <branch>"
        return 1
    fi
    
    # Find worktree path
    local worktree_path
    local found_branch
    
    git worktree list --porcelain | while read -r line; do
        if [[ "$line" =~ ^worktree ]]; then
            local path=${line#worktree }
            read -r head_line
            read -r branch_line
            local branch=${branch_line#branch refs/heads/}
            
            if [[ "$branch" == "$branch_name" ]] || [[ "$(basename "$path")" == "${branch_name//\//-}" ]]; then
                worktree_path="$path"
                found_branch="$branch"
                break
            fi
        fi
    done
    
    if [[ -z "$worktree_path" ]]; then
        print_status error "Worktree not found: ${branch_name}"
        return 1
    fi
    
    print_status warning "Remove worktree for branch '${found_branch}'?"
    print_status warning "Path: ${worktree_path}"
    echo -n "Confirm removal (y/N): "
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        if git worktree remove "$worktree_path" 2>/dev/null; then
            print_status success "Worktree removed: ${found_branch}"
            
            # Offer to delete branch
            echo -n "Delete branch '${found_branch}'? (y/N): "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                if git branch -d "${found_branch}" 2>/dev/null || git branch -D "${found_branch}" 2>/dev/null; then
                    print_status success "Branch deleted: ${found_branch}"
                else
                    print_status error "Failed to delete branch: ${found_branch}"
                fi
            fi
        else
            print_status error "Failed to remove worktree"
            print_status info "Try 'git worktree remove --force ${worktree_path}' if you have uncommitted changes"
        fi
    else
        print_status info "Removal cancelled"
    fi
}

# Main command handler
main() {
    local command=${1:-help}
    shift || true
    
    case "$command" in
        init)
            init_repository "$@"
            ;;
        new|add)
            create_worktree "$@"
            ;;
        list|ls)
            list_worktrees "$@"
            ;;
        switch|sw|cd)
            switch_worktree "$@"
            ;;
        update|pull)
            update_worktrees "$@"
            ;;
        clean|prune)
            clean_worktrees "$@"
            ;;
        status|st)
            show_status "$@"
            ;;
        open|edit)
            open_worktree "$@"
            ;;
        remove|rm)
            remove_worktree "$@"
            ;;
        help|--help|-h)
            show_help
            ;;
        version|--version|-v)
            echo "GTR version ${SCRIPT_VERSION}"
            ;;
        *)
            print_status error "Unknown command: ${command}"
            echo "Run 'gtr help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"