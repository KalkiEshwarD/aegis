# Page snapshot

```yaml
- main [ref=e4]:
  - generic [ref=e6]:
    - img [ref=e8]
    - heading "AegisDrive" [level=1] [ref=e10]
    - heading "Sign in to your vault" [level=6] [ref=e11]
    - form [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]:
          - text: Username or Email Address
          - generic [ref=e15]: "*"
        - generic [ref=e16]:
          - img [ref=e18]
          - textbox "Username or Email Address" [ref=e20]: test@example.com
          - group:
            - generic: Username or Email Address *
      - generic [ref=e21]:
        - generic [ref=e22]:
          - text: Password
          - generic [ref=e23]: "*"
        - generic [ref=e24]:
          - textbox "Password" [active] [ref=e25]: password123
          - button "toggle password visibility" [ref=e27] [cursor=pointer]:
            - img [ref=e28] [cursor=pointer]
          - group:
            - generic: Password *
        - paragraph [ref=e30]: Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character
      - button "Sign In" [disabled]
      - link "Don't have an account? Sign up" [ref=e32]:
        - /url: /register
```