const PasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const EmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const FullNameRegex = /^[A-Z][a-z'’-]{1,29}(?: [A-Z][a-z'’-]{1,29}){0,4}$/;

function ValidateEmailAddress(email: string): boolean {
    return EmailRegex.test(email);
}

function ValidatePassword(password: string): boolean {
    return PasswordRegex.test(password);
}

function ValidateFullName(name: string): boolean {
    return FullNameRegex.test(name);
}


export {
	EmailRegex, FullNameRegex, PasswordRegex, ValidateEmailAddress, ValidateFullName, ValidatePassword
};

